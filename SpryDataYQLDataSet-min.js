(function(){if(!Spry||!Spry.Data)return alert("Spry.Data.YQLDataSet depends on SpryData.js to loaded in advance.");Spry.Data.YQLDataSet=function(a,b,c){this.YQLServer="http://query.yahooapis.com/v1/public/yql?";this.env="http://datatables.org/alltables.env";this.format="json";this.timeout=1E4;this.query=a;this.prefix="yql_";this.path=b||false;this.preparseFunc=this.doc=null;this.diagnostics=false;Spry.Data.DataSet.call(this,c)};Spry.Data.YQLDataSet.prototype=new Spry.Data.DataSet;Spry.Data.YQLDataSet.prototype.constructor=Spry.Data.YQLDataSet;Spry.Data.YQLDataSet.id=0;Spry.Data.YQLDataSet.receiver={};Spry.Data.YQLDataSet.prototype.yql=function(a){var b=++Spry.Data.YQLDataSet.id,c={q:this.query,format:this.format,env:this.env,diagnostics:this.diagnostics,callback:"Spry.Data.YQLDataSet.receiver."+this.prefix+""+b},d=this,f,e,g,i;a=a||this.loadDataIntoDataSet;e=Spry.Data.YQLDataSet.receiver[this.prefix+""+b]=function(h){clearTimeout(i);h.error&&d.notifyObservers("onLoadError",h.error);if(h.results||h.query)a.call(d,h.results||h.query);try{var j=Spry.Data.YQLDataSet.receiver[d.prefix+""+b];j.script.parentNode.removeChild(j.script);delete Spry.Data.YQLDataSet.receiver[d.prefix+""+b]}catch(k){}};f=[];for(g in c)f.push(g+"="+encodeURIComponent(c[g]));f=this.YQLServer+f.join("&");e.script=document.createElement("script");e.script.type="text/javascript";e.script.src=f;e.script.setAttribute("async",true);this.notifyObservers("onPreLoad");document.getElementsByTagName("script")[0].appendChild(e.script);i=setTimeout(function(){d.timedOut(e,b)},this.timeout)};Spry.Data.YQLDataSet.prototype.loadData=function(){this.dataWasLoaded=false;if(!this.pendingRequest){this.yql();this.pendingRequest=true}};Spry.Data.YQLDataSet.prototype.loadDataIntoDataSet=function(a){this.doc=a;var b=[],c={};a=a.results?a.results:a;var d=0,f,e;if(this.preparseFunc)a=this.preparseFunc(a);if(this.path)a=Spry.Utils.getObjectByName(this.path,a);if(!a||Object.prototype.toString.call(a)!=="[object Array]")if(typeof a!=="object")b.push(c[0]={column0:a,ds_rowID:0});else{e=Spry.Data.YQLDataSet.flattenObject(a);e.ds_RowID=d;b.push(c[d]=e)}else for(f=a.length;d<f;d++){e=Spry.Data.YQLDataSet.flattenObject(a[d]);e.ds_RowID=d;b.push(c[d]=e)}this.data=b;this.dataHash=c;this.dataWasLoaded=true;this.pendingRequest=null;this.syncColumnTypesToData();this.applyColumnTypes();this.disableNotifications();this.filterAndSortData();this.enableNotifications();this.notifyObservers("onPostLoad");this.notifyObservers("onDataChanged")};Spry.Data.YQLDataSet.prototype.syncColumnTypesToData=function(){var a=this.data[0],b,c;for(b in a)if(!this.columnTypes[b])(c=typeof a[b]=="number")&&this.setColumnType(b,c)};Spry.Data.YQLDataSet.prototype.timedOut=function(a,b){var c=this;this.notifyObservers("onTimeOut");a.script.parentNode.removeChild(a.script);Spry.Data.YQLDataSet.receiver[c.prefix+""+b]=function(){delete Spry.Data.YQLDataSet.receiver[c.prefix+""+b]}};Spry.Data.YQLDataSet.prototype.getQuery=function(){return this.query};Spry.Data.YQLDataSet.prototype.setQuery=function(a){this.query=a;this.dataWasLoaded=false};Spry.Data.YQLDataSet.prototype.getPath=function(){return this.path};Spry.Data.YQLDataSet.prototype.setPath=function(a){if(this.path!=a){this.path=a;if(this.dataWasLoaded&&this.doc){this.notifyObservers("onPreLoad");this.loadDataIntoDataSet(this.doc)}}};Spry.Data.YQLDataSet.flattenObject=function(a,b){var c={};if(typeof a=="object")Spry.Data.YQLDataSet.copyProps(c,a);else c[b||"column0"]=a;c.ds_JSONObject=a;return c};Spry.Data.YQLDataSet.copyProps=function(a,b,c){if(a&&b)for(var d in b)c&&typeof b[d]=="object"||(a[d]=b[d]);return a};Spry.Utils.getObjectByName=function(a,b){var c=null,d=b||window,f,e,g;if(a){f=a.split(".");e=0;for(g=f.length;d&&e<g;e++)d=c=d[f[e]]}return c}})();