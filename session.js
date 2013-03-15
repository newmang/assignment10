// <!-- General documentation is in readme.txt -->
//
// File: session.js
// Class: Session
//
// Purpose:
// This is a session manager specificly for MongoLab.com intended
// for use on a PhoneGap mobile app.
//
// Each user has 1 entry in the database.
// Each entry has these fields:
//   _id		(auto-generated)
//   name
//   password	(MD5 hashed) [Others available: http://code.google.com/p/crypto-js]
//
// All other fields are OPTIONAL.
//
// A Session is an object initialized with the name of your MongoLab
// database, your collection name, and API key.
//
// Using a Session object, you can accomplish these tasks:
//   - Login with a username & password
//   - Access the database entry for the active session.
//   - Add/update fields in the database entry for the active session.
//   - Logout of the actove session.
//   - Create new users (ie. entries) in the database.
//   - OPTIONAL: Set fields for a user at the same time you create them.
//
// It should be safe to JSON.stringify() a Session object, store it in the HTML5
// feature sessionStorage, and pass it between different pages of a multi-page
// PhoneGap app, then reconstruct the active Session object using JSON.parse().

// Method: Constructor
// Purpose:
//   Collect the necessary data to make MongoLab requests.
function Session(database, collection, key) {
  this.database = database;		// from MongoLab
  this.collection = collection;	// from MongoLab
  this.key = key;				// from MongoLab

  // This is the base of the request URL, but no API key appended.
  this.urlBase = "https://api.mongolab.com/api/1/databases/" + this.database + "/collections/" + this.collection;

  this.active = false;	// login status
  this.user = null;	// an entry from the MongoLab database (the user that is currently logged in)
}

// Method: onStatusChange
// Purpose:
//   This is the callback that gets triggered when the login status is changed.
//   It is empty by default. You are expected to use the setEventListener method to set it.
Session.prototype.onStatusChange = function(status) { return; };

// Method: onDataWrite
// Purpose:
//   Another callback, but for the data_write event.
Session.prototype.onDataWrite = function(data) { return; };

// Method: setEventListener
// Purpose:
//   Allows you to define functions that get triggered as callbacks for specific events.
//   Right now, there is only 1 event type: status_change
Session.prototype.setEventListener = function (eventName, callback) {
  if( eventName === "status_change" ) {
    this.__proto__.onStatusChange = callback;
  }
  else if( eventName === "data_write" ) {
    this.__proto__.onDataWrite = callback;
  }
};

// Method: findUser
// Purpose:
//   Finds the user's entry in the database and returns it to a callback function asynchronously.
Session.prototype.findUser = function (userName, callback) {
  var filter, request;

  filter = { 'name': userName };		// the field and value we are searching for
  filter = JSON.stringify(filter);		// prepare it to be inserted into a URL

  // create a new HTTP request object
  request = new XMLHttpRequest();

  // register and define the async HTTP request callback
  request.onreadystatechange = function() {
    if( request.readyState == 4 && request.status == 200 ) {	// 4 = completed, 200 = sucsuccessful
      callback.call(null, JSON.parse(request.responseText));	// return the database entry, as an object
    }
  };

  // build the request and send it
  request.open("GET", this.urlBase + "?q=" + filter + "&fo=true" + "&apiKey=" + this.key, true);
  request.send(null);
};

// Method: login
// Purpose:
//   Searches for an entry in the database matching the user's name, compares the
//   hashed passwords to confirm that they match, and then saves the database entry
//   as a JS object into the this.user property.
Session.prototype.login = function (data) {
  var _this;

  // abort if user is already logged in
  if( this.active === true ) {
    alert("ERROR: Already logged in.");
    return;
  }

  // encrypt the password
  data.password = CryptoJS.MD5(data.password).toString();	// Note: MD5 is considered broken as a password encryption

  _this = this;	// save the pointer to this Session

  // get the database entry associated with this username
  this.findUser(data.name, function(response) {
    if( response === null ) {
      alert("ERROR: User not found.");
    }
    else {
      // the response object IS the database entry, but in JS object form
      if( response.password === data.password ) {
        _this.user = response;	// save the active user to the session
        _this.active = true;

        // notify any listening functions
        _this.onStatusChange(true);
      }
      else {
        alert("ERROR: Incorrect password.");
      }
    }
  });
};

// Method: logout
// Purpose:
//   Deactivates the current session.
Session.prototype.logout = function() {
  if( this.active !== true ) {
    alert("ERROR: You are already logged out.");
    return;
  }

  this.user = undefined;
  this.active = false;
  this.onStatusChange(false);	// notify any listening functions
};

// Method: write
// Purpose:
//   Writes data to the active user's database entry.
//   The data object is passed in exactly as the fields will/do appear in the database.
//   If a field does not exist in the database, it is automatically created.
Session.prototype.write = function(data) {
  var _this, request, filter;

  if( this.active !== true ) {
    alert("ERROR: You are not logged in.");
    return;
  }

  _this = this;	// save the pointer to this Session object

  request = new XMLHttpRequest();

  originalData = data;
  request.onreadystatechange = function() {
    if( request.readyState == 4 && request.status == 200 ) {
      // update the properties in the active Session's user object as well
      // FIXME: This will only update TOP LEVEL properties of the local user object, no nested properties.
      // NOTE: Nested properties are handled properly by MongoLab, this is just a local update problem.
      for( var property in originalData ) {
        _this.user[property] = originalData[property];
      }

      // notify any listening functions
      _this.onDataWrite(originalData);
    }
  };

  // search by database ID
  filter = { "_id": { "$oid": this.user._id["$oid"] } };
  filter = JSON.stringify(filter);

  // prepare the data to be inserted into the database
  data = { "$set": data };

  // generate our request and send it
  request.open("PUT", this.urlBase + "?q=" + filter + "&u=true"+ "&apiKey=" + this.key, true);	// the u=true parameter will create the field if it doesn't exist
  request.setRequestHeader("Content-Type", "application/json");
  request.send(JSON.stringify(data));
};

// Method: createUser
// Purpose:
//   Create an entry in the database using the object it is given.
Session.prototype.createUser = function(data) {
  var _this, request;

  _this = this;
  request = new XMLHttpRequest();

  request.onreadystatechange = function() {
    if( request.readyState == 4 && request.status == 200 ) {
      _this.user = JSON.parse(request.responseText);
      _this.active = true;

      // notify any listening functions (we are now logged in)
      _this.onStatusChange(true);
    }
  };

  // build the request and send it
  request.open("POST", this.urlBase + "?apiKey=" + this.key, true);
  request.setRequestHeader("Content-Type", "application/json");
  request.send(JSON.stringify(data));
};

// Method: write
// Purpose:
//   Make sure the user doesn't already exist in the database,
//   then create it.
Session.prototype.signup = function (data) {
  var _this;

  if( this.active === true ) {
    alert("ERROR: Already logged in.");
    return;
  }

  data.password = CryptoJS.MD5(data.password) + "";

  _this = this;
  this.findUser(data.name, function(response) {
    if( response === null ) {
      _this.createUser(data);
    }
    else {
      alert("ERROR: User already exists.");
    }
  });
};