class SettingsService {
  constructor(db) {
    this.db = db;
    this.cache = new Map();
  }
  
  /**
   * Get a setting value by key
   */
  async getSetting(key) {
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    
    try {
      const result = await this.db.query(
        'SELECT value FROM app_settings WHERE key = $1',
        [key]
      );
      
      if (result.rows.length > 0) {
        const value = result.rows[0].value;
        this.cache.set(key, value);
        return value;
      }
      
      return null;
    } catch (error) {
      console.error(`Error getting setting ${key}:`, error);
      return null;
    }
  }
  
  /**
   * Set a setting value
   */
  async setSetting(key, value) {
    try {
      // Convert value to string if it's not already
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      await this.db.query(
        `INSERT INTO app_settings (key, value) 
         VALUES ($1, $2) 
         ON CONFLICT (key) 
         DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
        [key, stringValue]
      );
      
      // Update cache
      this.cache.set(key, stringValue);
      
      return true;
    } catch (error) {
      console.error(`Error setting ${key}:`, error);
      return false;
    }
  }
  
  /**
   * Get all settings
   */
  async getAllSettings() {
    try {
      const result = await this.db.query(
        'SELECT key, value FROM app_settings'
      );
      
      const settings = {};
      result.rows.forEach(row => {
        // Try to parse JSON values, otherwise return as string
        try {
          settings[row.key] = JSON.parse(row.value);
        } catch {
          settings[row.key] = row.value;
        }
      });
      
      return settings;
    } catch (error) {
      console.error('Error getting all settings:', error);
      return {};
    }
  }
  
  /**
   * Update multiple settings at once
   */
  async updateSettings(settings) {
    const client = await this.db.getClient();
    
    try {
      await client.query('BEGIN');
      
      for (const [key, value] of Object.entries(settings)) {
        // Skip certain keys that shouldn't be stored
        if (key.includes('ApiKey') && value === '***configured***') {
          continue;
        }
        
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
        
        await client.query(
          `INSERT INTO app_settings (key, value) 
           VALUES ($1, $2) 
           ON CONFLICT (key) 
           DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
          [key, stringValue]
        );
        
        // Update cache
        this.cache.set(key, stringValue);
      }
      
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating settings:', error);
      return false;
    } finally {
      client.release();
    }
  }
  
  /**
   * Load all settings into cache
   */
  async loadSettingsToCache() {
    try {
      const settings = await this.getAllSettings();
      
      for (const [key, value] of Object.entries(settings)) {
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
        this.cache.set(key, stringValue);
      }
      
      console.log(`[Settings] Loaded ${this.cache.size} settings from database`);
      return true;
    } catch (error) {
      console.error('Error loading settings to cache:', error);
      return false;
    }
  }
  
  /**
   * Get setting with type conversion
   */
  async getSettingValue(key, defaultValue = null) {
    const value = await this.getSetting(key);
    
    if (value === null) {
      return defaultValue;
    }
    
    // Try to parse as JSON for complex types
    try {
      return JSON.parse(value);
    } catch {
      // Return as string if not JSON
      return value;
    }
  }
  
  /**
   * Get boolean setting
   */
  async getBooleanSetting(key, defaultValue = false) {
    const value = await this.getSetting(key);
    
    if (value === null) {
      return defaultValue;
    }
    
    return value === 'true' || value === true;
  }
  
  /**
   * Get numeric setting
   */
  async getNumericSetting(key, defaultValue = 0) {
    const value = await this.getSetting(key);
    
    if (value === null) {
      return defaultValue;
    }
    
    const num = parseFloat(value);
    return isNaN(num) ? defaultValue : num;
  }
}

module.exports = SettingsService;