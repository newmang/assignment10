function Session(database, collection, key) {
  this.database = database;
  this.collection = collection;
  this.key = key;
  this.urlBase = "https://api.mongolab.com/api/1/databases/" + this.database + "/collections/" + this.collection;

  this.active = false;
  this.user = null;
}

Session.prototype.login = function (data) {
  if( this.active === true ) {
    alert("ERROR: Already logged in.");
    return;
  }

  data.password = CryptoJS.MD5(data.password) + "";

  var _this = this;
  this.findUser(data.name, function(response) {
    if( response === null ) {
      alert("ERROR: User not found.");
    }
    else {
      if( response.password === data.password ) {
        _this.user = response;
        _this.active = true;
        _this.onStatusChange(true);
      }
      else {
        alert("ERROR: Incorrect password.");
      }
    }
  });
};

Session.prototype.logout = function() {
  if( this.active !== true ) {
    alert("ERROR: You are already logged out.");
    return;
  }

  this.user = undefined;
  this.active = false;
  this.onStatusChange(false);
};

Session.prototype.write = function(data) {
  if( this.active !== true ) {
    alert("ERROR: You are not logged in.");
    return;
  }

  var _this = this;
  var request = new XMLHttpRequest();

  request.onreadystatechange = function() {
    if( request.readyState == 4 && request.status == 200 ) {
      _this.onDataWrite();
    }
  };

  var filter = { "_id": { "$oid": this.user._id["$oid"] } };
  filter = JSON.stringify(filter);

  data = { "$set": data };

  request.open("PUT", this.urlBase + "?q=" + filter + "&u=true"+ "&apiKey=" + this.key, true);
  request.setRequestHeader("Content-Type", "application/json");
  request.send(JSON.stringify(data));
};

Session.prototype.findUser = function (userName, callback) {
  var filter = { 'name': userName };
  filter = JSON.stringify(filter);

  var request = new XMLHttpRequest();
  request.onreadystatechange = function() {
    if( request.readyState == 4 && request.status == 200 ) {
      callback.call(this, JSON.parse(request.responseText));
    }
  };

  request.open("GET", this.urlBase + "?q=" + filter + "&fo=true" + "&apiKey=" + this.key, true);
  request.send(null);
};

Session.prototype.createUser = function(data) {
  var _this = this;
  var request = new XMLHttpRequest();

  request.onreadystatechange = function() {
    if( request.readyState == 4 && request.status == 200 ) {
      _this.user = JSON.parse(request.responseText);
      _this.active = true;
      _this.onStatusChange(true);
    }
  };

  request.open("POST", this.urlBase + "?apiKey=" + this.key, true);
  request.setRequestHeader("Content-Type", "application/json");
  request.send(JSON.stringify(data));
};

Session.prototype.onStatusChange = function(state) {
  if( state === true ) {
    document.getElementById("profile").value = JSON.stringify(this.user);
  }
  else {
    document.getElementById("profile").value = "Not logged in.";
  }
};

Session.prototype.onDataWrite = function() {
  this.findUser(this.user.name, function(response) {
    this.user = response;
    document.getElementById("profile").value = JSON.stringify(this.user);
  });
};

Session.prototype.signup = function (data) {
  if( this.active === true ) {
    alert("ERROR: Already logged in.");
    return;
  }

  data.password = CryptoJS.MD5(data.password) + "";

  var _this = this;
  this.findUser(data.name, function(response) {
    if( response === null ) {
      _this.createUser(data);
    }
    else {
      alert("ERROR: User already exists.");
    }
  });
};