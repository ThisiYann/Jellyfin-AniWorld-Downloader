const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'views')));
app.use(express.static('uploads'));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/js', express.static(path.join(__dirname, 'js')));

app.get('/travel', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'class', 'travel.html'));
});

app.get('/d', (req, res) => {
    fs.readFile(path.join(__dirname, 'assets', 'database', 'destination.json'), 'utf8', (err, data) => {
        if (err) {
            res.status(500).send('Error reading file');
        } else {
            try {
                const jsonData = JSON.parse(data);
                res.json(jsonData);
            } catch (jsonErr) {
                res.status(500).send('Error parsing JSON');
            }
        }
    });
});

// Penanganan halaman 404
app.use((req, res, next) => {
    res.status(404).sendFile(path.join(__dirname, 'views', '404.html'));
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
