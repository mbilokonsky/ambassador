var mastodon = require('mastodon');
var pg = require('pg');

var query = `SELECT id, favourites_count 
FROM statuses 
WHERE favourites_count > (
  SELECT avg(favourites_count) 
  FROM statuses 
  WHERE favourites_count > 1
  AND created_at > NOW() - INTERVAL '30 days'
)
AND created_at > NOW() - INTERVAL '30 days';`

var config = {
  user: process.env.DB_USER || 'mastodon',
  database: process.env.DB_NAME || 'mastodon_production',
  password: process.env.DB_PASSWORD || '',
  host: process.env.DB_HOST || '/var/run/postgresql',
  port: 5432, //env var: PGPORT
  max: 2, // max number of clients in the pool
  idleTimeoutMillis: 30000, // how long a client is allowed to remain idle before being closed
};

const pool = new pg.Pool(config);

pool.query(query, [], function(err, res) {
  if(err) {
    return console.error('error running query', err);
  }

  res.rows.forEach(function(row) {
    console.dir(row);
  });
});