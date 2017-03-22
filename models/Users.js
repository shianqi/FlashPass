let mongoose = require('mongoose');

let UserSchemas = new mongoose.Schema({
	username: String,
	password: String,
	email: String,
	emailActivated: Boolean,
});

UserSchemas.statics = {
	getSize: function(cb){
		return this
			.count()
			.exec(cb);
	},
	findById: function(id, cb){
		return this
			.findOne({_id:id})
			.exec(cb);
	},
	findByUsername: function (username, cb) {
		return this
			.findOne({username:username})
			.exec(cb);
	}
};

let Users = mongoose.model('UserSchemas',UserSchemas);
module.exports = Users;