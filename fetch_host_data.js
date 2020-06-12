const fetch_host = (tenantURL, apiKey, hostTags, dbHost, dbUser, dbPass, dbDb) => {
    // Load required packages
    const fetch = require('node-fetch'); // for making http calls
    const mysql = require('mysql'); // for connecting to db

    // Setup variables
    const headers = {
        'Authorization': `Api-Token ${apiKey}`,
        'Accept': 'application/json'
    }; // headers used during api calls

    // connect to the db
    const con = mysql.createConnection({
            host: dbHost,
            user: dbUser,
            password: dbPass,
            database: dbDb
        }); 
        con.connect(function(err) {
        if (err) throw err;
        console.log("Connected!");
    });

    // fecth the host data and populate in db
    formatTags = Array.isArray(hostTags) ? `&tag=${hostTags.join('$tag=')}` : '';
    apiURI = `/api/v1/entity/infrastructure/hosts?showMonitoringCandidates=false${formatTags}`;
    console.log(`${tenantURL}${apiURI}`);
    (async () => {
        let r = await fetch(`${tenantURL}${apiURI}`, {'headers': headers});
        let rj = await r.json();
        await Promise.all(
            rj.map(async h => {
                    if (h.hasOwnProperty('softwareTechnologies')){
                        for (let i of h.softwareTechnologies){
                            if (i.type.toUpperCase() == 'KUBERNETES' && h.monitoringMode.toUpperCase() === 'FULL_STACK'){
                                h.toRelationships.isProcessOf.map(v => {
                                    // write pgi 2 host relationship
                                    let q = `INSERT INTO tbl_pgi2host (pgi_id, host_id) VALUES ("${v}", "${h.entityId}")
                                        ON DUPLICATE KEY UPDATE pgi_id="${v}", host_id="${h.entityId}"`;
                                    con.query(q, function (err) {
                                        if (err) throw err;
                                    });
                                });
                                // write host to db
                                let q = `INSERT INTO tbl_hostdata (host_id, displayName, consumedHostUnits)
                                    VALUES ("${h.entityId}","${h.displayName}","${h.consumedHostUnits}")
                                    ON DUPLICATE KEY UPDATE host_id="${h.entityId}", displayName="${h.displayName}",
                                    consumedHostUnits="${h.consumedHostUnits}"`;
                                con.query(q, function (err) {
                                    if (err) throw err;
                                });
                            }
                        }
                    }
            })
        ).then(con.end(() => { console.log(`${new Date()} - host data imported`); })).catch(e => { console.log(e); });
    })().catch(e => { console.log(e); });
}
module.exports = {
    fetch_host: fetch_host,
};