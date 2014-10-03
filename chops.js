/**
 * Chops - Client HTML5 on Push State
 *
 * @version 0.0.1
 * @author Christian Blanquera <cblanquera@openovate.com>
 * @website https://github.com/cblanquera/chops
 * @license MIT
 */
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
			
			if(event === 'request' && __refresh) {
				__pushLink(window.location.href);
				__refresh = false;
			}
			
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
					
					__pushLink(this.href);
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
				
				__pushForm(this);
			});
		};
		
		/* Private Methods
		-------------------------------*/
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
		
		var __pushLink = function(url) {
			var state = { 
				url		: url,
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
			
			//remove the origin
			if(state.url.indexOf(window.location.origin) === 0) {
				state.url = state.url.substr(window.location.origin.length);
			}
			
			var flat = {}, query = state.query.split('&');
			for(var setting, i = 0; i < query.length; i++) {
				setting = query[i].split('=');
				flat[setting.shift()] = setting.join('=');
			}
			
			state.data.serialized = state.data.flattened = flat;
			state.data.json = state.data.expanded = __expand(state.data.serialized);
			
			//push the state
			window.history.pushState(state, '', url);
		};
		
		var __pushForm = function(form) {
			var url = $(form).attr('action') || window.location.href;
				
			var state = { 
				url		: url,
				query	: $(form).serialize(), 
				method	: $(form).attr('method') || 'GET', 
				data	: {
					flattened	: {},
					expanded	: {},
					serialized	: {},
					json		: {}
				} };
			
			//populate state with what we know
			state.method = state.method.toUpperCase();
			
			//remove the origin
			if(state.url.indexOf(window.location.origin) === 0) {
				state.url = state.url.substr(window.location.origin.length);
			}
			
			var flat = $(form).serializeArray();
			
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
			$('input[type="file"]', form).each(function() {
				//if there is no name to this
				if(!this.name || !this.name.length) {
					//skip it
					return;
				}
				
				//store the files
				for(var i = 0; i < this.files.length; i++) {
					state.data.flattened[this.name + '[' + i + ']'] = this.files[i];
				}
			});
			
			//make an expanded version of the data
			state.data.expanded = __expand(state.data.flattened);
			
			//push the state
			window.history.pushState(state, '', state.url);
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