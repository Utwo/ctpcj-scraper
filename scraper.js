const cheerio = require('cheerio');
const request = require('async-request');
const csv = require('csvtojson');
const fs = require('fs');

const liniiUrbaneUrl = 'http://ctpcj.ro/index.php/ro/orare-linii/linii-urbane';
const liniiMetropolitaneUrl = 'http://ctpcj.ro/index.php/ro/orare-linii/linii-metropolitane';
const liniiSuperMarketUrl = 'http://ctpcj.ro/index.php/ro/orare-linii/linii-supermarket';
const csvBaseUrl = 'http://ctpcj.ro/orare/csv/orar_';
const jsonFileBasic = 'static/busses_basic.json';
const jsonFileDetail = 'static/busses_detail.json';

let defaultOptions = {
    writeToFile: false
}

async function scrap(data) {
    try {
        $ = cheerio.load(data);
        let lines = [];
        $('.tz_item .tz-inner .tz-des').each(function(index, element) {
            const lineItem = {
                name: $(this).find('h6 a').text().trim().substring(6).replace(" ", ""),
                url: $(this).find('h6 a').attr('href').trim(),
                route: $(this).find('.ruta').text().trim(),
            };
            lines.push(lineItem);
        }) ;

        return lines;
    } catch(e) {
        throw e;
    }
}

async function loadPage(url) {
    return request(url, {
        headers: {
            host: 'ctpcj.ro',
            Referer: 'http://ctpcj.ro/index.php/ro/orare-linii/linii-urbane/linia1'
        },
    }).then(resp => {
        if(resp.statusCode != 200) {
            throw `Could not load ${url}`;
        }        
        return resp;
    });
}
 
async function csvToJson(csvData) {
    const jsonObject = {};
    const linies = [];
    let i = 0;

    if(!csvData) {
        return;
    }

    return new Promise((resolve) => {
        csv({
            noheader: true,
            flatKeys: true,
            headers: [1, 2]
        }).fromString(csvData)
            .on('csv', (csvRow) => {
                if (i < 5) {
                    jsonObject[csvRow[0]] = csvRow[1];
                } else {
                    linies.push(csvRow);
                }
                i++;
            })
            .on('done', (error) => {
                jsonObject.linies = linies;
                resolve(jsonObject);
            })
    });
}

async function writeToJsonFile(file, data){
    if(defaultOptions.writeToFile){
        return fs.writeFile(file, JSON.stringify(data), (err) => {
            if(err) {
                console.error(err);
            }
        });
    }
}

async function main(options) {
    defaultOptions = Object.assign({}, defaultOptions, options);
    let scraperResponse;

    const [urbane, metropolitane, market]  = await Promise.all([
            loadPage(liniiUrbaneUrl).then(html => scrap(html.body)).catch(e => console.error(e)),
            loadPage(liniiMetropolitaneUrl).then(html => scrap(html.body)).catch(e => console.error(e)),
            loadPage(liniiSuperMarketUrl).then(html => scrap(html.body)).catch(e => console.error(e))
        ])

    market.map(linie => {
        linie.name = linie.name.toLowerCase();
    })

    scraperResponse = { urbane, metropolitane, market }

    writeToJsonFile(jsonFileBasic, scraperResponse);

    for([key1, linies] of Object.entries(scraperResponse)) {
        for([key2, linie] of linies.entries()) {

            const [lv, s, d] = await Promise.all([
                loadPage(csvBaseUrl + linie.name + '_lv.csv').then(html => csvToJson(html.body)).catch(e => console.log(e)),
                loadPage(csvBaseUrl + linie.name + '_s.csv').then(html => csvToJson(html.body)).catch(e => console.log(e)),
                loadPage(csvBaseUrl + linie.name + '_d.csv').then(html => csvToJson(html.body)).catch(e => console.log(e))
            ]);

            scraperResponse[key1][key2].statii = {lv, s, d};
            writeToJsonFile('static/' + linie.name + '.json', scraperResponse[key1][key2]);
        }
    }

    // const value = await Promise.all([scraperResponse]);
    scraperResponse.update = Date.now();
    writeToJsonFile(jsonFileDetail, scraperResponse);
    return scraperResponse;
}

exports.scrap = main;