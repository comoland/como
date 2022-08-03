import timer from './bench';

let db = Como.sql("sqlite3", "./heloo-date2.db?_journal_mode=WAL");

(async function(){

    db.exec.sync(`CREATE TABLE place (
        id INTEGER PRIMARY KEY,
        country text,
        city text NULL,
        createdAt date NULL,
        telcode integer);`);

    const obj = await db.exec('INSERT INTO place (country, telcode, createdAt) VALUES (?, ?, ?)', "Hong Kong deeeesdfsdfsdfe", 9.9, (new Date()).toISOString());
    console.log(obj);
    const rr = await db.query("SELECT id, country, telcode, city, createdAt FROM place WHERE id=? LIMIT ?", obj.lastInsertId, 10)
    console.log(rr);

    // const arr = db.arr({hello: "there", "test": 8});
    // console.log(arr)
    // const e = await db.query();
    // console.log(e)
    // const [result, error] = await dd.exec('INSERT INTO place (country, telcode) VALUES (?, ?)', "Hong Kong", 852);
    // if (error) {
    //     throw error
    // }

    // console.log(result)
})();

// setInterval(() => {

//     const obj33 =  db.exec.sync('INSERT INTO place (country, telcode, createdAt) VALUES (?, ?, ?)', "Hong Kong deeeesdfsdfsdfe", 99, (new Date()).toISOString());

//     console.log('ddddddddddddd => ', obj33);

// }, 1)

let i = 0;

// setInterval(() => {
//     console.log('running ==> ', i)
// }, 10);




(async function(){
    for await (let { req, res } of Como.http(":8080")) {
        // req.query.ttt
        res.body('rrrrrrrrrrrrrrrrrrrrrrrr ' + req.uri)
        // return
    }
})();

(async function(){
    const db = Como.sql("sqlite3", "./heloo-date2.db?_journal_mode=WAL&cache=shared&mode=ro");
    const end = timer();
    const trans = db.begin()
    while(i++ < 50000) {
        await trans.exec(`
            INSERT INTO place (
                country,
                telcode,
                createdAt
            )
            VALUES (
                ?,
                ?,
                ?
            )
        `, "Hong Kong deeeesdfsdfsdfe", 99, (new Date()).toISOString());
    }
    trans.commit()
    console.log('done');
    end();
})();


(async function(){
    const end = timer();
    const db = Como.sql("sqlite3", "./heloo-date2.db?_journal_mode=WAL&cache=shared&mode=ro");
    const mm = await db.query('SELECT * from place WHERE id > 1000 LIMIT 20000');
    console.log(mm.length)
    end();
})();




// setInterval(() => {
//     console.log('running')
// }, 1000)
