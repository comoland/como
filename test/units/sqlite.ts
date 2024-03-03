import { suite, assert } from '../mod';

const test = suite('sql');

test('sql basics', async () => {
    const db = Como.sql('sqlite3', 'file::memory:?cache=shared');

    db.exec.sync(`
        CREATE TABLE place (
            id INTEGER PRIMARY KEY,
            country text,
            city text NULL,
            createdAt date NULL,
            telcode integer
        );`);

    const date = new Date();
    const obj = await db.exec(
        'INSERT INTO place (country, telcode, createdAt) VALUES (?, ?, ?)',
        'Hong Kong',
        9.9,
        date.toISOString()
    );
    const result = await db.query(
        'SELECT id, country, telcode, city, createdAt FROM place WHERE id=? LIMIT ?',
        obj.lastInsertId,
        10
    );

    assert.equal(obj, {
        error: null,
        lastInsertId: 1,
        rowsAffected: 1
    });

    assert.equal(result, [
        {
            createdAt: date.getTime(),
            id: 1,
            country: 'Hong Kong',
            telcode: 9.9,
            city: null
        }
    ]);

    db.close();
});

test('sql trans', async () => {
    const db = Como.sql('sqlite3', 'file::memory:?cache=shared');

    db.exec.sync(`
        CREATE TABLE place (
            id INTEGER PRIMARY KEY,
            country text,
            city text NULL,
            createdAt date NULL,
            telcode integer
        );`);

    let i = 0;

    const trans = db.begin();
    while (i++ < 1000) {
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
        `,
            'Hong Kong',
            99,
            new Date().toISOString()
        );
    }


    const result = await trans.query('SELECT id, country, telcode, city, createdAt FROM place LIMIT ?', 10000);
    result.forEach((record, i) => {
        assert.equal(record.id, i+1);
    })

    assert.equal(result.length, 1000);
    trans.rollBack();

    const result2 = await db.query('SELECT id, country, telcode, city, createdAt FROM place LIMIT ?', 10000);
    assert.equal(result2.length, 0);

    db.close();
});

test.run();
