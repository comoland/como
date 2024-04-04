const db = Como.sql('sqlite3', './test.db?_journal=WAL&_cache_size=6000000000');


// db.exec.sync(`
// CREATE TABLE place (
//     id INTEGER PRIMARY KEY,
//     country text,
//     city text NULL,
//     createdAt date NULL,
//     telcode integer
// );`);


(async() => {
    console.time("bench")

    const arr = [...Array(365).keys()];

    // db.exec.sync(`BEGIN;`)
    // const m = db.begin()

    // const reults = await m.exec(`UPDATE place
    // SET city = ?
    // WHERE  id = ?`, "Amman")

    // console.log(reults)

    // const res = await db.query(`SELECT *, SUM(telcode) AS sum from place;`)
    // console.log(res)

    const res = await db.query(`SELECT * from place where id = 1;`)
    console.log(res)

    console.timeEnd("bench")

    // console.log(res)

    // for (let i of arr) {
    //     // const date = new Date();
    //     // const obj = await m.exec(
    //     //     'INSERT INTO place (country, telcode, createdAt) VALUES (?, ?, ?)',
    //     //     'Hong Kong',
    //     //     i,
    //     //     date.toISOString()
    //     // );

    //     const reults = await m.exec(`UPDATE place
    //     SET city = ?
    //     WHERE  id = ?`, "Zarka", i)
    // }

    // m.commit();
    // db.exec.sync(`COMMIT;`)

    // arr.forEach(() => {

    // })

    console.timeEnd("bench")
})();