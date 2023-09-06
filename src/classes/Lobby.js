var { ws } = require('../../../../index.js');

const { Soup } = require('stews');
const Player = require('./Player.js');
const CoolError = require('./CoolError.js');
const PangineClassBuilder = require('../builders/PangineClassBuilder.js');
const ID = require('./ID.js');


class Lobby {
    constructor(parent, ctx=null, settings={ starterPlayerValues:{}, values:{}, idLength:4, id:null }) {
		this.__proto__ = parent.Lobby.prototype;

		
		if (!settings.starterPlayerValues) settings.starterPlayerValues = {};
		if (!settings.values) settings.values = {};
		if (!settings.idLength) settings.idLength = 4;
        if (!ctx) ctx = ws.ctx;

		
        this.parent = parent
        this.players = new Soup(Object);
		this.starterPlayerValues = Soup.from(settings.starterPlayerValues);
		this.id = (settings.id) ? settings.id : new ID(settings.idLength)();
		this.values = new Soup(settings.values);
		this.ctx = ctx;
		this.home = null;

		
        var self = this;

		
		var locked = false
		Object.defineProperty(this, "locked", {
			get() { 
				return locked;
			},
			set(to) {
				locked = to;
				
				if (to == true) parent.events.lockLobby.fire(self);
				else if (to == false) parent.events.unlockLobby.fire(self);
			}
		});


		
        this.Player = PangineClassBuilder(new Proxy( class {
            constructor(user) {
				if (self.locked) throw new CoolError("Lobby Locked", "Player attempted to join a locked lobby.");
                
				let player = new Player(self, ...Array.from(arguments));
				self.players.push(user.id, player);
				parent.events.playerJoin.fire(player, self);
				return player;
			}
		}, {
			set(target, prop, value) {
				target[prop] = value;
				parent.events.updatePlayer.fire(prop, target, self);
			}
		}));
		
		Object.defineProperty(this.Player, "name", { value: "Player" });

		
		this.Value = PangineClassBuilder(new Proxy( class Value {
            constructor(name, content) {
                self.values.push(name, content)
                parent.events.createLobbyValue.fire(self.values[name], self);
                
                return self.values[name];
        	}
		}, {
			set(target, prop, value) {
				target[prop] = value;
				parent.events.updateLobbyValue.fire(prop, target, self);
			}
		}));


		this.parent.starterLobbyValues.forEach( (k, v) => {
			new this.Value(k, v);
		});

		
		this.StarterPlayerValue = PangineClassBuilder(new Proxy( class StarterPlayerValue {
            constructor(name, content) {
                self.starterPlayerValues.push(name, content)

				self.players.forEach( (k, v) => {
					if (!v.values.has(name)) v.push(name, content);
				});
				
                parent.events.createStarterPlayerValue.fire(self.starterPlayerValues[name], self);
                
                return self.starterPlayerValues[name];
        	}
		}, {
			set(target, prop, value) {
				target[prop] = value;
				parent.events.updateStarterPlayerValue.fire(prop, target, self);
			}
		}));


		this.Signal = PangineClassBuilder(class Signal {
			constructor(name) {
				this.name = name;
				this.parent = self;
				parent.events.createSignal.fire(this, self);
			}

			throw() {
				parent.signals.push(this.name, Array.from(arguments));
				parent.events.throwSignal.fire(this, self);
			}

			catch() {
				let content = parent.signals.get(this.name);
				parent.events.catchSignal.fire(this, content, self);
				parent.signals.delete(this.name);
				return content;
			}
		})

		
		let host = (ctx.author) ? ctx.author : ctx.user;
		this.host = new this.Player(host);

		
		this.__proto__.close = function close() {
			this.parent.lobbies.delete(this.id);
		}
		this.__proto__.lock = function lock() {
			this.lock = true;
		}
		this.__proto__.unlock = function unlock() {
			this.lock = false;
		}

		
		return new Proxy(this, {
			get(target, prop) {
				if (target.values.has(prop)) return target.values.get(prop);
				else return target[prop];
			},

			set(target, prop, value) {
				if (target.values.has(prop)) return target.values.set(prop, value);
				else return target[prop] = value;
			},

			delete(target, prop) {
				if (target.values.has(prop)) return target.values.delete(prop);
				else return delete target[prop];
			}
		});
    }
	
}



module.exports = Lobby
