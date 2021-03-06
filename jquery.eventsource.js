/*!
 * jQuery Event Source
 * 
 * Copyright (c) 2010 Rick Waldron
 * Dual licensed under the MIT and GPL licenses.
 */

;(function ($) {

  $.extend($.ajaxSettings.accepts, {
    stream: 'text/event-stream'
  })  
  
  var stream  = {
  
    defaults: {
      //  IDENTITY  
      label:    null,
      url:      null,

      //  EVENT CALLBACKS
      open:     $.noop,
      message:  $.noop
    },
    setup: {
      stream:   {}, 
      lastEventId: 0,
      isNative: false,
      history:  {},
      options:  {}
    },    
    cache:  {}
  },
  
  pluginFns   = {
    
    public: {
      close: function ( label ) {
        
        var cache = {};
        
        if ( label !== '*' ) {
        
          for ( var prop in stream.cache ) {
            if ( label  !== prop ) {
              cache[prop] = stream.cache[prop];
            }
          }
        }
        
        stream.cache = cache;
        
        return stream.cache;
      }, 
      streams: function ( label ) {
      
        if ( label === '*' ) {
          return stream.cache;
        }
        
        return stream.cache[label] || {};
      }
    },    
    _private: {

      isJson:       function ( arg ) {
        if ( arg === null ) {
          return false;
        }
        
        return ( 
          new RegExp('^("(\\\\.|[^"\\\\\\n\\r])*?"|[,:{}\\[\\]0-9.\\-+Eaeflnr-u \\n\\r\\t])+?$') 
        ).test($.isPlainObject(arg) ? JSON.stringify(arg) : arg);        
      },    
    
      //  Open a native event source 
      openEventSource: function ( options ) {
           
        stream.cache[options.label].stream.addEventListener('open', function (event) {
          if ( stream.cache[options.label] ) {
          
            this['label']  = options.label;
            
            stream.cache[options.label].options.open.call(this, event);
          }   
        }, false);


        stream.cache[options.label].stream.addEventListener('message', function (event) {
          
          if ( stream.cache[options.label] ) {
          
            var streamData  = [];

            streamData[streamData.length] = pluginFns._private.isJson(event.data) ? 
                                              JSON.parse(event.data) : 
                                              event.data
                

            this['label']  = options.label;
            
            stream.cache[options.label].lastEventId = +event.lastEventId;
            stream.cache[options.label].history[stream.cache[options.label].lastEventId]  = streamData;
            stream.cache[options.label].options.message.call(this, streamData[0] ? streamData[0] : null, {
              data: streamData,
              lastEventId: stream.cache[options.label].lastEventId
            }, event);
          }          
        }, false);        
        
        
        return stream.cache[options.label].stream;
      }, 
      // open fallback event source
      openPollingSource: function ( options ) {
        
        if ( stream.cache[options.label] ) {
        
          var source  = $.ajax({
            type:       options.requestType ? options.requestType : "GET",
            url:        options.url,
            data:       options.data,
            ifModified: options.ifModified ? true : false,
            beforeSend: function () {
              if ( stream.cache[options.label] ) {
                
                this['label'] = options.label;
                stream.cache[options.label].options.open.call(this);
              }   
            },
            success: function ( data ) {

              var tempdata,
                  parsedData  = [],
                  streamData  = $.map(  data.split("\n"), function (sdata, i) {
                                  if ( sdata ) {
                                    return sdata;
                                  }
                                });

              if ( $.isArray(streamData) ) {
              
                for ( var i = 0; i < streamData.length; i++ ) {

                  tempdata  = streamData[i].split('data: ')[1];
                  
                  // CONVERT TO PROPER `dataType` HERE
                  if ( options.dataType === 'json' ) {
                    tempdata  = JSON.parse(tempdata);
                  }


                  parsedData[parsedData.length] = tempdata;
                }
              }
              
              if ( stream.cache[options.label] ) {
                
                
                this['label'] = options.label;
                
                stream.cache[options.label].lastEventId++;
                stream.cache[options.label].history[stream.cache[options.label].lastEventId]  = parsedData;
                stream.cache[options.label].options.message.call(this, parsedData[0] ? parsedData[0] : null, {
                  data: parsedData,
                  lastEventId: stream.cache[options.label].lastEventId
                });


                setTimeout(
                  function () {
                    pluginFns._private.openPollingSource.call(this, options);
                  },
                  options.requestInterval ? options.requestInterval : 500 // matches speed of native EventSource
                );
              }                
            },
            cache:      false,
            timeout:    options.timeout ? options.timeout : 50000
          });
        }
        return source;
      }
    }
  },
  isNative    = window.EventSource ? true : false 
  ;

  $.eventsource = function ( options ) {
      
    var _stream, _options;

    //  Plugin sub function
    if ( options && !$.isPlainObject(options) && pluginFns.public[options] ) {
      //  If no label was passed, send message to all streams
      return pluginFns.public[options](  
                arguments[1] ?
                  arguments[1]  :
                  '*'
              );
    }

    //  If params were passed in as an object, normalize to a query string
    options.data    = options.data && $.isPlainObject(options.data) ? 
                        $.param(options.data) : 
                        options.data;      

    //  Mimick the native behavior?
    if ( !options.url || typeof options.url !== 'string'  ) {
      throw new SyntaxError('Not enough arguments: Must provide a url');
    }


    //  If no explicit label, set internal label
    options.label   = !options.label ? 
                        options.url + '?' + options.data : 
                        options.label;


    //  Create new options object
    _options        = $.extend({}, stream.defaults, options);

    //  Create empty object in `stream.cache`
    stream.cache[_options.label] = {
      options: _options
    };


    //  Determine and declare `stream`
    _stream  = !isNative ?
                //  If not native, open a polling fallback
                pluginFns._private.openPollingSource(_options) :
                new EventSource(_options.url + ( _options.data ? '?' + _options.data : '' ) );

    //  ADd to event sources
    stream.cache[_options.label] = $.extend({}, stream.setup, {
      stream: _stream, 
      isNative: isNative, 
      options: _options
    });


    if ( isNative ) {
      pluginFns._private.openEventSource(_options);
    }

    return stream.cache;
  };


})(jQuery);