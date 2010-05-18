/* Copyright Arnout Kazemier, license: github.com/3rd-Eden/Spry-YQL-DataSet, version: 1.0 */
(function(){
	if( !Spry || !Spry.Data ){
		return alert( "Spry.Data.YQLDataSet depends on SpryData.js to loaded in advance." )
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
		this.diagnostics = false;
		
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
				diagnostics: this.diagnostics,
				callback: "Spry.Data.YQLDataSet.receiver." + this.prefix + "" + id 
			},
			
			// reference to self, so we can execute the data
			that = this,
			
			// speeds up references to document
			doc = document,
			
			// and we will fill up these variables later on
			url, reciever, tmp, timeouttimer;
		
		// ability to specify a other callback 
		callback = callback || this.loadDataIntoDataSet;
		
		// create a public callback for the query
		reciever = Spry.Data.YQLDataSet.receiver[ this.prefix + "" + id ] = function( data ){			
			// clear the timeout
			reciever.done = true;
			
			// IE doesn't recognise my timeout.. 
			if( timeouttimer )
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
				// remove the script from the dom
				reciever.script.parentNode.removeChild( reciever.script );
				reciever = null;
				
				// remove from the array
				delete Spry.Data.YQLDataSet.receiver[ that.prefix + "" + id ];
			} catch( failure ){}
		};
		
		// construct the url
		url = [];
		for( tmp in parameters ){
			url.push( tmp + '=' + encodeURIComponent( parameters[ tmp ] ) );
		}
		
		url = this.YQLServer + url.join( "&" );
		
		// setup the JSONP call
		reciever.script = doc.createElement( "script" );
		reciever.script.type = "text/javascript";
		reciever.script.src = url;
		reciever.script.setAttribute( "async", true );
		
		// starting the request
		this.notifyObservers( "onPreLoad" );
		
		// find a target to append to, there is always one script on the page.. or we couldn't be executing this :)!
		tmp = doc.getElementsByTagName( "script" )[0];
		tmp.parentNode.insertBefore( reciever.script, tmp );
		
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
			// if we are dealing with an object, we are going to flatten it and serve it as one result
			if( typeof result !== "object" ){
				dataset.push( 
							(
								hash[0] = {
										column0:result, 
										ds_rowID: 0 
										}
								) 
						);
			} else {
				tmp = Spry.Data.YQLDataSet.flattenObject( result );
				tmp.ds_RowID = i;
				
				// add it to our set
				dataset.push( ( hash[i] = tmp ) );
			}
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
		
		// stuff the results in the dataset
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
		
		// this snipped is based on the JSON Dataset version :), but with 1 less fn call for the data ;)
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
		if( !reciever ) return;
		
		var that = this,
			script = reciever.script, parent;
		
		if( !reciever.done ){
			this.notifyObservers( "onTimeOut" );
			
			// remove script
			if( script && ( parent = script.parent ) )
			
				parent.removeChild( reciever.script );
			// ignore the rest, remove reciever from memory
			Spry.Data.YQLDataSet.receiver[ that.prefix + "" + id ] = function(){ delete Spry.Data.YQLDataSet.receiver[ that.prefix + "" + id ]; }; 
		}
		
	};
	
	// return the current query
	Spry.Data.YQLDataSet.prototype.getQuery = function getQuery(){
		return this.query;
	};
	
	// set a new query
	Spry.Data.YQLDataSet.prototype.setQuery = function setQuery( query ){
		this.query = query;
		this.dataWasLoaded = false;
	};
	
	// returns the current path
	Spry.Data.YQLDataSet.prototype.getPath = function getPath(){
		return this.path;
	};
	
	// set a new path and update the dataset
	Spry.Data.YQLDataSet.prototype.setPath = function setPath( path ){
		if( this.path != path ){
			this.path = path;
			
			// this allows us to actually update our dataset without having to do a new request
			if( this.dataWasLoaded && this.doc ){
				this.notifyObservers( "onPreLoad" );
				this.loadDataIntoDataSet( this.doc );
			}
		}
	};
	
	/*
		By using a JSON data set based setup we can hopefully attach the nestedJSON dataset on
		the YQLDataSet. 
	*/
	Spry.Data.YQLDataSet.flattenObject = function flattenObject( obj, basename ){
		var row = {};
		
		if( typeof obj == "object" ){
			Spry.Data.YQLDataSet.copyProps( row, obj );
		} else {
			row[ basename || "column0" ] = obj;
		}
		
		row.ds_JSONObject = obj;
		return row;
	};
	
	Spry.Data.YQLDataSet.copyProps = function copyProps( target, source, ignore ){
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
	
	// modified from the origional to be used with a context argument to search for "paths" inside objects
	Spry.Utils.getObjectByName = function getObjectByName( name, context ){
		var result = null,
			lu = context || window, objPath, i, length;
			
		if (name) {
			
			objPath = name.split( "." );
			
			for ( i = 0, length = objPath.length; lu && i < length; i++ ){
				result = lu[ objPath[i] ];
				lu = result;
			}
		}
		return result;
	};
	
	// this little snippet introduces the sprystate="timeout" functionality so you can display a seperate state when
	// your dataset has timed out	
	Spry.Data.Region.prototype.onTimeOut = function(){
		 if( this.currentState != "timeout" )
			this.setState( "timeout" );
		
		Spry.Data.Region.notifyObservers( "onTimeOut", this );
	};
	
})()