require('./findShim.js'); // Adds the find() function to Array prototype

// Gather requireds
var restify = require('restify'),
	sqlite3 = require('sqlite3').verbose(),
	fs = require('fs'),
	dbFile = "notes.db",
	db = new sqlite3.Database(dbFile),
	server = restify.createServer(),
	moment = require('moment');

// Setup the database if it doesn't already exist
db.serialize(function() {
	// Create the table structure
	db.run("CREATE TABLE IF NOT EXISTS Notes (" + 
		"id INTEGER PRIMARY KEY, " +
		"title VARCHAR(250) NOT NULL, " + 
		"body TEXT NULL, " + 
		"created DATETIME NULL, " + 
		"keywords TEXT NULL)");
	
	// Insert some test data
	db.get("SELECT count(*) rowCount FROM Notes", function(err, row) {
		console.log(row);
		var isEmpty = !(row.rowCount);
		if(isEmpty) {
			console.log('Generating test data...');
			var insertQuery = db.prepare("INSERT INTO Notes (title,body,created,keywords) VALUES (?,?,?,?)");
			var max = 10;
			for(var i = 1; i <= max; i++) {
				insertQuery.run(
					"Note "+i, 
					"This is a test note. "+i+"/"+max, 
					moment().subtract(i, 'days').toDate(),
					"Test");
			}
			insertQuery.finalize();
			console.log('Done generating test data.');
		}
			
		db.serialize(function() {
			// Show the existing notes on the console 
			db.each("SELECT id, title, body, created, keywords FROM Notes", function(err, row) {
				console.log(
					row.id + " : " + 
					row.title + " : " + 
					row.body + " : " + 
					moment(row.created).fromNow() + " : ",
					row.keywords);
			});
		});
	});
});


server.pre(restify.pre.userAgentConnection());

function unknownMethodHandler(req, res) {
    if (req.method.toLowerCase() === 'options') {
      var allowHeaders = ['Accept', 'Accept-Version', 'Content-Type', 'Api-Version', 'Origin', 'X-Requested-With', 'Authorization']; // added Origin & X-Requested-With & **Authorization**

      if (res.methods.indexOf('OPTIONS') === -1) res.methods.push('OPTIONS');

      res.header('Access-Control-Allow-Credentials', true);
      res.header('Access-Control-Allow-Headers', allowHeaders.join(', '));
      res.header('Access-Control-Allow-Methods', res.methods.join(', '));
      res.header('Access-Control-Allow-Origin', req.headers.origin);

      return res.send(200);
   }
   else{
      return res.send(new restify.MethodNotAllowedError());
   }
}

server.on('MethodNotAllowed', unknownMethodHandler);

// GLOBAL
server.use(restify.CORS());
server.use(restify.fullResponse());
server.use(restify.bodyParser());
server.use(function(req, res, next) {
	console.log('%s: %s', req.route.method, req.href());
	req.db = db;
	next();
});

// NOTES 

// GET
server.get('/api/notes', function(req, res, next) {
	req.db.all("SELECT * FROM Notes", function(err, rows) {
		console.log(rows);
		res.json({'notes': rows});
	});
    next();
});

server.get('/api/notes/:id', function(req, res, next) {
	req.db.get("SELECT * FROM Notes WHERE id = ?", req.params.id, function(err, row) {
		console.log(row);
		res.json({'note':row});
	});
    next();
});

// POST
server.post('/api/notes', function(req, res, next) {
	req.db.get("SELECT MAX(id) maxId FROM Notes", function(err, row) {
		var maxId = parseInt(row.maxId, 10);
		var newNote = createNote(maxId, req.params.note);
		req.db.run("INSERT INTO Notes (title,body,created,keywords) VALUES ($title,$note,$created,$keywords)", [
			newNote.title, newNote.body, newNote.created, newNote.keywords], function(err, row) {
				newNote.id = this.lastID;
				res.json({'note': newNote});
			});
	});
  	next();
});

function createNote(maxId, note) {
  //console.log('Max ID: ' + maxId);
  var nextId = maxId+1;
  var newNote = note;
  newNote.id = nextId;
  console.log(newNote);
  return newNote;
}

// UPDATE
server.put('/api/notes/:id', function(req, res, next) {
	console.log(req.params.note.id + ', ' + req.params.note.title + ', ' + req.params.note.body + ', ' + req.params.note.created);
	req.db.run("UPDATE Notes SET title = $title, body = $body, created = $created, keywords = $keywords WHERE id = $id", {
		$id: req.params.note.id,
		$title: req.params.note.title,
		$body: req.params.note.body,
		$created: req.params.note.created,
		$keywords: req.params.note.keywords
	}, function() {
		res.json({'note': req.params.note});
	});

	next();
});

// DELETE
server.del('/api/notes/:id', function(req, res, next) {
	req.db.run("DELETE FROM Notes WHERE id = ?", parseInt(req.params.id, 10), function(err) {
		if(err) {
			console.log(err);
			res.send(500);
		} else {
			res.json({});
		}
	});
	next();
});

server.listen(8080, function() {
	console.log('%s listening at %s', server.name, server.url);
});
