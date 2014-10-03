(function() {
	var chops = function() {
		/* Require
		-------------------------------*/
		var $ = jQuery;
		
		/* Constants
		-------------------------------*/
		/* Public.Properties
		-------------------------------*/
		/* Protected Properties
		-------------------------------*/
		/* Private Properties
		-------------------------------*/
		var __refresh = false;
		
		/* Magic
		-------------------------------*/
		this.___construct = function() {
			//from a refresh - quirk
			__refresh = true;
			
			//hijack url changes
			this._hijackPushState();
			this._hijackPopState();
			//hijack links
			this._hijackLinks();
			//hijack forms
			this._hijackForms();
			
			//listen for a url request
			this.on('request', function() {
				//from a refresh - quirk
				__refresh = false;
			}).trigger('request');
		};
		
		/* Public.Methods
		-------------------------------*/
		/**
		 * Global event listener for the server
		 *
		 * @return this
		 */
		this.on = function(event, callback) {
			$(window).on(event, callback);
			return this;
		};
	
		/**
		 * Global event listener for the server once
		 *
		 * @return this
		 */
		this.once = function(event, callback) {
			$(window).one(event, callback);
			return this;
		};
	
		/**
		 * Stops listening to a specific event
		 *
		 * @return this
		 */
		this.off = function(event, handler) {
			if(handler) {
				$(window).unbind(event, handler);
				return this;
			}
	
			$(window).unbind(event);
			return this;
		};
		
		/**
		 * Global event trigger for the server
		 *
		 * @return this
		 */
		this.trigger = function() {
			$(window).trigger.apply($(window), arguments);
			return this;
		};
		
		/* Protected Methods
		-------------------------------*/
		this._hijackPushState = function() {
			//remember the push state
			var pushState = window.history.pushState;
			
			//override the function
			window.history.pushState = function(state, name, href) {
				if (typeof window.history.onpushstate == 'function') {
					window.history.onpushstate({state: state});
				}
				
				var results = pushState.apply(window.history, arguments);
				
				
				
				//now trigger something special
				var event = jQuery.Event('request');
				event.state = state;
				$(window).trigger(event, [href, state]);
				
				return results;
			};
		};
		
		this._hijackPopState = function() {
			window.onpopstate = function(e) {
				//from a refresh - quirk
				if(__refresh) {
					__refresh = false;
					return;
				}
				
				//now trigger something special
				var event = jQuery.Event('request');
				event.state = e.state;
				$(window).trigger(event, [window.location.href, window.history.state]);
			};
		};
		
		this._hijackLinks = function() {
			//live listen to all links
			$(document).on('click', 'a', function(e) {
				//if another event says to do nothing
				if(e.originalEvent.stop) {
					//do nothing
					return;
				}
				
				//if the link is in the same domain
				if(this.href.indexOf(window.location.origin) === 0) {
					//stop it
					e.preventDefault();
					
					var state = { 
						url		: this.href,
						query	: '', 
						method	: 'GET', 
						data	: {
							flattened	: {},
							expanded	: {},
							serialized	: {},
							json		: {}
						} };
					
					//if there is a ?
					if(state.url.indexOf('?') !== -1) {
						state.query = state.url.split('?')[1];
					} 
					
					var flat = {}, query = state.query.split('&');
					for(var setting, i = 0; i < query.length; i++) {
						setting = query[i].split('=');
						flat[setting.shift()] = setting.join('=');
					}
					
					state.data.serialized = state.data.flattened = flat;
					state.data.json = state.data.expanded = __expand(state.data.serialized);
					
					//push the state
					window.history.pushState(state, '', this.href);
				}
			});
		};
		
		this._hijackForms = function() {
			//listen to form submits
			$(document.body).on('submit', 'form', function(e) {
				//if the action is not in the same domain
				if($(this).attr('action') 
				&& $(this).attr('action').length
				&& $(this).attr('action').indexOf(window.location.origin) !== 0
				&& $(this).attr('action').indexOf('/') !== 0) {
					//do nothing
					return;
				}
				
				//if another event says to do nothing
				if(e.originalEvent.stop) {
					//do nothing
					return;
				}
				
				//at this point, the form is for local processing.
				
				//stop it
				e.preventDefault();
				
				var state = { 
					url		: $(this).attr('action') || window.location.href,
					query	: $(this).serialize(), 
					method	: $(this).attr('method') || 'GET', 
					data	: {
						flattened	: {},
						expanded	: {},
						serialized	: {},
						json		: {}
					} };
				
				//populate state with what we know
				state.method = state.method.toUpperCase();
				
				var flat = $(this).serializeArray();
				
				for(var i = 0; i < flat.length; i++) {
					state.data.flattened[flat[i].name] = flat[i].value;
					state.data.serialized[flat[i].name] = flat[i].value;
				}
				
				//make an expanded version of the data
				state.data.json = __expand(state.data.serialized);
				
				//is it a GET request ?
				if(state.method === 'GET') {
					//manually form the HREF
					//if there is a ?
					if(state.url.indexOf('?') !== -1) {
						state.url = state.url.split('?')[0];
					} 
					
					//populate the state
					state.url += '?' + state.query;
				}
				
				//it is a post, delete, put, whateva ...
				
				//is there files?
				$('input[type="file"]', this).each(function() {
					//if there is no name to this
					if(!this.name || !this.name.length) {
						//skip it
						return;
					}
					
					//store the files
					state.data.flattened[this.name] = this.files;
				});
				
				//make an expanded version of the data
				state.data.expanded = __expand(state.data.flattened);
				
				//push the state
				window.history.pushState(state, '', state.url);
			});
		};
		
		/* Private Methods
		-------------------------------*/
		/**
		 * Converts a query string to an object
		 *
		 * @param string
		 * @return object
		 */
		var __queryToHash = function(data) {
			var hash = {};
			
			//if empty data
			if(data.length == 0) {
				//return empty hash
				return {};
			}
			
			//split the query by &
			var queryArray = data.split('&');
			
			//loop through the query array
			for (var propertyArray, hashNameArray, 
			curent, next, name, value, j, i = 0; 
			i < queryArray.length; i++) {
				//split name and value
				propertyArray = queryArray[i].split('=');
				
				propertyArray[1] = propertyArray[1] || '';
				
				//url decode both name and value
				name = decodeURIComponent(propertyArray[0].replace(/\+/g, '%20'));
				value = decodeURIComponent(propertyArray[1].replace(/\+/g, '%20'));
				
				//if no value
				if (!propertyArray[1]) {
					//if no name
					if(!propertyArray[0]) {
						//do nothing
						continue;
					}
					
					value = null;
				}
				
				//At this point, we have a key and value
				
				//is value a a string but a number ?
				//and there is a decimal ?
				if(typeof value == 'string' 
				&& !/[a-zA-Z\+]/.test(value)
				&& !/^0/.test(value)
				&& !isNaN(parseFloat(value))
				&& value.indexOf('.') != -1) {
					value = parseFloat(value);
				//is value a a string but a number ?
				} else if(typeof value == 'string' 
				&& !/[a-zA-Z\+]/.test(value)
				&& !/^0/.test(value) 
				&& !isNaN(parseFloat(value))) {
					value = parseInt(value);
				}
				
				//if no array marker
				if(name.indexOf('[') == -1) {
					//simply put it in hash
					hash[name] = value;
					//we are done
					continue;
				}
				
				//At this point, we have a hash key and value
				
				//BEFORE:
				//hash[key1][some][]
				//hash[][some][key1]
				
				hashNameArray = name.split('[');
				
				//AFTER:
				//hash, key1], some, ]
				//hash, ], some], key1]
				
				current = hash;
				for(j = 0; j < hashNameArray.length; j++) {
					//remove straggling ]
					name = hashNameArray[j].replace(']', '');
					
					//is there more names ?
					if((j + 1) == hashNameArray.length) {
						//we are done
						break;
					}
					
					//at this point there are more names
					//hash, key1, some, ]
					//hash, ], some], key1]
					
					//does it exist ? 
					if(!current[name]) {
						next =  {}
						
						//if no name
						//it is possible for numbers to be the name
						if(hashNameArray[j + 1] == ']'
						|| (!isNaN(parseFloat(hashNameArray[j + 1].replace(']', ''))) 
						&& isFinite(hashNameArray[j + 1].replace(']', '')))) {
							next = [];
						}
						
						
						//is the current an array ?
						if(current instanceof Array) {
							current.push(next);
						} else {
							current[name] = next;
						}
					}
					
					//at this point next exists
					
					//is the current an array ?
					if(current instanceof Array) {
						//traverse
						current = current[current.length - 1];
						continue;
					}
					
					//traverse
					current = current[name];
				}
				
				//is the current an array ?
				if(current instanceof Array) {
					current.push(value);
					continue;
				}
				
				//current can be undefined because it reached
				//a datatype that cannot be traversable
				if(current) {
					current[name] = value;
				}
			}
			
			return hash;
		};
		
		/** 
		 * Flattens data for update
		 *
		 * @param object nested object
		 * @return object
		 */
		var __collapse = function(data) {
			var result = {}, recurse = function(data, property) {
				
				if (Object(data) !== data) {
					result[property] = data;
					return;
				}  
				
				if (Array.isArray(data)) {
					if (data.length == 0) {
						result[property] = [];
						return;
					}
					
					for(var i = 0;  i < data.length; i++) {
						 recurse(data[i], property ? property + '][' + i : ''+i);
					}
					
					return;
				} 
				
				var isEmpty = true;
				
				for (var key in data) {
					isEmpty = false;
					recurse(data[key], property ? property + '][' + key : key);
				}
				
				if (isEmpty) {
					result[property] = {};
				}
			};
			
			recurse(data, '');
			
			return result;
		};
	
		/**
		 * Unflattens an object
		 *
		 * @param object
		 * @return object
		 */
		var __expand = function(data) {
			var i, dot, path, pointer, object = {};
			
			for(var key in data) {
				if(data.hasOwnProperty(key)) {
					if(key.indexOf('[') === -1) {
						object[key] = data[key];
						continue;
					}
					
					dot = key
						.replace(/\]\[/g, '.')
						.replace(/\[/g, '.')
						.replace(/\]/g, '')
					
					//it hash a .
					//key1.0.key2
					path = dot.split('.');
					pointer = object;
					
					for(var i = 0; i < path.length; i++) {
						if(typeof pointer[path[i]] === 'undefined') {
							//if there is a next path
							//and it is a number
							if(typeof path[i+1] !== 'undefined'
							&& !isNaN(parseInt(path[i+1]))) {
								pointer[path[i]] = [];
							} else {
								pointer[path[i]] = {};
							}
						}
						
						if(i < (path.length - 1)) {
							//move on
							pointer = pointer[path[i]];
						}
					}
					
					pointer[path[i - 1]] = data[key];
				}
			}
			
			return object;
		};
	};
	
	/* Adaptor
	-------------------------------*/
	//if AMD
	if(typeof define === 'function') {
		define(['jquery', 'classified'], function(jQuery, classified) {
			return function() {
				return classified(chops)();
			};
		});
	//how about jQuery?
	} else if(typeof jQuery === 'function' && typeof jQuery.extend === 'function') {
		jQuery.extend({
			chops: function() {
				return this.classified(chops)();
			}
		});
	//ok fine lets put it in windows.
	} else if(typeof window === 'object') {
		window.chops = function() {
			return window.classified(chops)();
		};
	}
})();