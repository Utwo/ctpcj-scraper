// modules
const schedule = require('node-schedule')
const scraper = require('./scraper')
const express = require('express');
const app = express();
const port = 4001;

app.use(express.static('static'))

app.get('/secret', (req, res) => {
  	scraper.scrap(
  		{
  			writeToFile: true
  		}).then(data => {
			res.json(data);
	  	}).catch(e => {
			res.json(e);
		});
});

app.listen(port, () => console.log('CTP scraper running on port %d', port));

schedule.scheduleJob('0 0 * * *', () => { 
	scraper.scrap().catch(e => {
		console.error(e)	
	});
}) // run everyday at midnight

/*
sa schimb din console.error in altceva
sa rulez scriptul de scraping doar daca ultimul update este mai vechi de o zi
*/