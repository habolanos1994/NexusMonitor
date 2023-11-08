

const sql = require('mssql');
const fs = require('fs');

const config = {
    user: 'SvcSmart_Ate_Write',
    password: '8kvmduhoyDAkHAlktBwb',
    server: 'CHY-MFGSTDSQL1',
    database: 'SMART_ATE',
    options: {
        trustedConnection: true,
        trustServerCertificate: true,
        enableArithAbort: true,
        instancename: ''
    },
};

sql.connect(config)
    .then(() => {
        return sql.query(`
            SELECT 
                [MODEL_NAME],
                [PRODUCT_CODE]
            FROM [SMART_ATE].[dbo].[DATA_RECEIVER_MODELS]
        `);
    })
    .then(result => {
        const models = result.recordset.map(row => ({
            model: row.MODEL_NAME,
            code: row.PRODUCT_CODE,
        }));

        const json = JSON.stringify({ models }, null, 2);

        fs.writeFile('counterconf.json', json, 'utf8', (err) => {
            if (err) {
                console.log("An error occured while writing JSON Object to File.");
                return console.log(err);
            }
         
            console.log("JSON file has been saved.");
        });
    })
    .catch(err => {
        console.error(err);
    });
