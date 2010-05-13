(function(){
	if( !Spry || !Spry.Data ){
		return alert( "Spry.Data.YQLDataSet depends on SpryData.js to loaded in advance" )
	}
	
	Spry.Data.YQLDataSet = function( query, path, options ){
		
		this.YQLServer = "http://query.yahooapis.com/v1/public/yql?";
		this.env = "http://datatables.org/alltables.env";
		this.format = "json";
		this.timeout = 10000;
		this.query = query;
		this.prefix = "yql_";
		this.path = path || "";
		this.doc = null;
		
		Spry.Data.DataSet.call( this, options );
	};
	
	Spry.Data.YQLDataSet.prototype = new Spry.Data.DataSet();
	Spry.Data.YQLDataSet.prototype.constructor = Spry.Data.YQLDataSet;
	
	// used to generate unique id's for the recievers
	Spry.Data.YQLDataSet.id = 0;
	
	// stores all public callbacks
	Spry.Data.YQLDataSet.receiver = {};
	
	Spry.Data.YQLDataSet.prototype.query = function query( callback ){
		
		var id = ++Spry.Data.YQLDataSet.id,
			parameters = {
				q: this.query,
				format: this.format,
				evn: this.env,
				callback: "Spry.Data.YQLDataSet.receiver." + this.prefix + "" + id, 
			},
			
			// reference to self, so we can execute the data
			that = this,
			
			// and we will fill up these variables later on
			url, reciever, tmp, timeouttimer;
		
		// ability to specify a other callback 
		callback = callback || this.loadDataIntoDataSet;
		
		// create a public callback for the query
		reciever = Spry.Data.YQLDataSet.receiver[ this.prefix + "" + id ] = function( data ){
			// clear the timeout
			clearTimeout( timeouttimer );
			
			// do we have errors
			if( data.error ){
				that.notifyObservers( "onLoadError", data.error );
			}
			
			// process the data
			if( data.query ){
				callback( data.query );
			}
			
			// clean up
			try{
				// shortcut to the reciever
				var cleanup = Spry.Data.YQLDataSet.receiver[ that.prefix + "" + id ];
				
				// remove the script from the dom
				cleanup.script.parentNode.removeChild( cleanup.script );
				cleanup = null;
				
				// remove from the array
				delete Spry.Data.YQLDataSet.receiver[ that.prefix + "" + id ];
			} catch( failure ){}
		};
		
		
		// construct the url
		url = [];
		for( tmp in parameters ){
			url.push( tmp + '=' + encodeURIComponent( parameters[ tmp ] ) );
		}
		
		url = this.YQLServer + url.join("&");
		
		reciever.script = document.createElement( "script" );
		reciever.script.type = "text/javascript";
		reciever.script.src = url;
		reciever.script.setAttribute( "async", true );
		
		// starting the request
		this.notifyObservers( "onPreLoad" );
		
		// find a target to append to
		document.getElementsByTagName( "script" )[0].appendChild( reciever.script );
		
		// set our timeout
		timeouttimer = setTimeout( function(){ self.timeout( reciever, id ) }, this.timeout );
		
	};
	
	Spry.Data.YQLDataSet.prototype.loadData = function(){
		this.dataWasLoaded = false;
		
		if( !this.pendingRequest ){
			this.query();
			this.pendingRequest = true;
		}
	};
	
	Spry.Data.YQLDataSet.prototype.loadDataIntoDataSet = function loadDataIntoDataSet( data ){
		this.doc = data;
		
		var dataset = [],
			hash = {};
		
		// todo process the data based on path
		
		
		// process completed and notify the user
		this.dataWasLoaded = true;
		this.pendingRequest = false;
		
		this.syncColumnTypesToData();
		this.applyColumnTypes();

		this.disableNotifications();
		this.filterAndSortData();
		this.enableNotifications();

		this.notifyObservers("onPostLoad");
		this.notifyObservers("onDataChanged");
	};
	
	// call a timeout instance
	Spry.Data.YQLDataSet.prototype.timeout = function timeout( reciever, id ){
		this.notifyObservers( "onTimeOut" );
		
		// remove script
		reciever.script.parentNode.removeChild( reciever.script );
		reciever = function(){}; // ignore the rest
		
		delete Spry.Data.YQLDataSet.receiver[ this.prefix + "" + id ];
	}
})()