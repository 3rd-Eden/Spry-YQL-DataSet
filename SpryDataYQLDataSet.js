(function(){
	if( !Spry || !Spry.Data ){
		return alert( "Spry.Data.YQLDataSet depends on SpryData.js to loaded in advance" )
	}
	
	Spry.Data.YQLDataSet = function( query, path, options ){
		
		this.YQLServer = "http:/"+"/query.yahooapis.com/v1/public/yql?";
		this.env = "http:/"+"/datatables.org/alltables.env";
		this.format = "json";
		this.timeout = 10000;
		this.query = query;
		this.prefix = "yql_";
		this.path = path || false;
		this.doc = null;
		this.preparseFunc = null;
		
		Spry.Data.DataSet.call( this, options );
	};
	
	Spry.Data.YQLDataSet.prototype = new Spry.Data.DataSet();
	Spry.Data.YQLDataSet.prototype.constructor = Spry.Data.YQLDataSet;
	
	// used to generate unique id's for the recievers
	Spry.Data.YQLDataSet.id = 0;
	
	// stores all public callbacks
	Spry.Data.YQLDataSet.receiver = {};
	
	Spry.Data.YQLDataSet.prototype.yql = function query( callback ){
		
		var id = ++Spry.Data.YQLDataSet.id,
			parameters = {
				q: this.query,
				format: this.format,
				env: this.env,
				callback: "Spry.Data.YQLDataSet.receiver." + this.prefix + "" + id 
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
			if( data.results || data.query ){
				callback.call( that, data.results || data.query );
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
		
		// find a target to append to, there is always one script on the page.. or we couldn't be executing this :)!
		document.getElementsByTagName( "script" )[0].appendChild( reciever.script );
		
		// set our timeout
		timeouttimer = setTimeout( function(){ that.timedOut( reciever, id ) }, this.timeout );
		
	};
	
	Spry.Data.YQLDataSet.prototype.loadData = function(){
		this.dataWasLoaded = false;
		
		if( !this.pendingRequest ){
			this.yql();
			this.pendingRequest = true;
		}
	};
	
	/*
		By using a JSON data set based setup we can hopefully attach the nestedJSON dataset on
		the YQLDataSet. 
	*/
	Spry.Data.YQLDataSet.flattenObject = function( obj, basename ){
		var row = {};
		
		if( typeof obj == "object" ){
			Spry.Data.YQLDataSet.copyProps( row, obj );
		} else {
			row[ basename || "column0" ] = obj;
		}
		
		row.ds_JSONObject = obj;
		return row;
	};
	
	Spry.Data.YQLDataSet.copyProps = function( target, source, ignore ){
		if( target && source ){			
			for( var row in source){
				if( ignore && typeof source[ row ] == "object" ){
					continue;
				}
				
				target[ row ] = source[ row ];
			}
		}
		
		return target;
	};
	
	Spry.Data.YQLDataSet.prototype.loadDataIntoDataSet = function loadDataIntoDataSet( data ){
		
		this.doc = data;
		
		var dataset = [],	// we gonna store the rows in this
			hash = {},		// our datahash
			result = data.results ? data.results : data, // check for potential data locations
			i = 0, length, tmp;
			
		/*
			As we have no indication on how to parse the data we depend on the users to parse the
			data for us and make sure we have the correct results to fuse to the dataset
		*/
		if( this.preparseFunc )
			result = this.preparseFunc( result );
		
		// execute the path, in search for data :)!
		if( this.path )
			result = Spry.Utils.getObjectByName( this.path, result );
		
		
		
		if( !result || Object.prototype.toString.call( result ) !== "[object Array]" ){
			// Create dummy data if we are not dealing with an array :)
			dataset.push( 
						(
							hash[0] = {
									column0:result, 
									ds_rowID: 0 
									}
							) 
					);
		} else {
			// process the rest of the shizzle, as we are dealing with an array
			for( length = result.length; i < length; i++ ){
				
				// make sure we are only storing objects in our dataset
				tmp = Spry.Data.YQLDataSet.flattenObject( result[i] );
				tmp.ds_RowID = i;
				
				// add it to our set
				dataset.push( ( hash[i] = tmp ) );
			}
		}
		
		// todo process the data based on path
		//dataset = dataset.concat( result );
		
		this.data = dataset;
		this.dataHash = hash;
		
		// process completed and notify the user
		this.dataWasLoaded = true;
		this.pendingRequest = null;
		
		this.syncColumnTypesToData();
		this.applyColumnTypes();

		this.disableNotifications();
		this.filterAndSortData();
		this.enableNotifications();

		this.notifyObservers( "onPostLoad" );
		this.notifyObservers( "onDataChanged" );
	};
	
	Spry.Data.YQLDataSet.prototype.syncColumnTypesToData = function syncColumnTypesToData(){
		
		// Run through every column in the first row and set the column type
		// to match the type of the value currently in the column, but only
		// if the column type is not already set.
		//
		// For the sake of performance, there are a couple of big assumptions
		// being made here. Specifically, we are assuming that *every* row in the
		// data set has the same set of column names defined, and that the value
		// for a specific column has the same type as a value in the same column
		// in any other row.
		
		// this snipped is based on the JSON Dataset version :), but with 1 less fn call ;)
		// see http://labs.adobe.com/technologies/spry/includes/SpryJSONDataSet.js for license
			
		var row = this.data[0], 
			colName, type;
		
		for ( colName in row ){
			if( !this.columnTypes[ colName ] ) {
				type = typeof row[ colName ] == "number";
				
				if ( type )
					this.setColumnType( colName, type );
			}
		}
	};
	
	// call a timeout instance
	Spry.Data.YQLDataSet.prototype.timedOut = function timedOut( reciever, id ){		
		var that = this;
		this.notifyObservers( "onTimeOut" );
		// remove script
		reciever.script.parentNode.removeChild( reciever.script );
		// ignore the rest, remove reciever from memory
		Spry.Data.YQLDataSet.receiver[ that.prefix + "" + id ] = function(){ delete Spry.Data.YQLDataSet.receiver[ that.prefix + "" + id ]; }; 
		
	};
	
	// modified from the origional to be used with a context argument to search for "paths" inside objects
	Spry.Utils.getObjectByName = function( name, context ){
		var result = null,
			lu = context || window, objPath, i, length;
			
		if (name) {
			
			objPath = name.split(".");
			
			for ( i = 0, length = objPath.length; lu && i < length; i++ ){
				result = lu[ objPath[i] ];
				lu = result;
			}
		}
		return result;
	};
	
})()