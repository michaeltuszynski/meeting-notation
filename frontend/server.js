const express = require('express');
const path = require('path');
const app = express();

app.use(express.static('public'));
app.use(express.static('build'));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Frontend running at http://localhost:${PORT}`);
});
