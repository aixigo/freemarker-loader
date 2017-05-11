/**
 * Copyright 2017 aixigo AG
 * Released under the MIT license.
 * https://opensource.org/licenses/MIT
 */

'use strict';

const path = require( 'path' );
const java = require( 'java' );

const JAVA_IO = 'java.io';
const JAVA_UTIL = 'java.util';

const LONG = 'java.lang.Long';
const EXCEPTION = 'java.lang.Exception';
const PIPED_WRITER = JAVA_IO + '.PipedWriter';
const PIPED_READER = JAVA_IO + '.PipedReader';
const ARRAY_LIST = JAVA_UTIL + '.ArrayList';
const HASH_MAP = JAVA_UTIL + '.HashMap';
const DATE = JAVA_UTIL + '.Date';
const LOCALE = JAVA_UTIL + '.Locale';
const SUPPLIER = JAVA_UTIL + '.function.Supplier';
const FUNCTION = JAVA_UTIL + '.function.Function';
const BI_FUNCTION = JAVA_UTIL + '.function.BiFunction';
const PATTERN = JAVA_UTIL + '.regex.Pattern';

const CONFIGURATION = 'freemarker.template.Configuration';
const FALLBACK_FORMAT = 'freemarker.core.UndefinedOutputFormat';
const OUTPUT_FORMATS = {
   css: 'freemarker.core.CSSOutputFormat',
   html: 'freemarker.core.HTMLOutputFormat',
   js: 'freemarker.core.JavaScriptOutputFormat',
   json: 'freemarker.core.JSONOutputFormat',
   rtf: 'freemarker.core.RTFOutputFormat',
   txt: 'freemarker.core.PlainTextOutputFormat',
   xhtml: 'freemarker.core.XHTMLOutputFormat',
   xml: 'freemarker.core.XMLOutputFormat'
};
const TEMPLATE_EXCEPTION_HANDLER = 'freemarker.template.TemplateExceptionHandler';
const TEMPLATE_LOADER = 'freemarker.cache.TemplateLoader';

module.exports = {
   pipe,
   toJava,
   getLocale,
   getFreemarkerConfig,
   getTemplateLoaderImplementation
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function pipe( fns, callback ) {
   const stack = fns.slice();

   iterate( null );

   function iterate( err ) {
      const fn = stack.shift();

      if( err || !fn ) {
         callback.apply( null, arguments );
      }
      else {
         fn.apply( null, Array.prototype.slice.call( arguments, 1, fn.length ).concat( [ iterate ] ) );
      }
   }
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function getFreemarkerConfig( loaderContext, options, resourceLoaders ) {
   const encoding = options.encoding || 'UTF-8';
   const locale = options.locale;
   const format = options.format || path.extname( loaderContext.resourcePath ).substr( 1 );

   const fmconfig = java.newInstanceSync( CONFIGURATION );

   const fmformat = java.import( OUTPUT_FORMATS[ format ] || FALLBACK_FORMAT ).INSTANCE;
   const fmloader = java.newProxy( TEMPLATE_LOADER,
      getTemplateLoaderImplementation( loaderContext, resourceLoaders || [] ) );
   const fmlocale = getLocale( locale );
   const fmexcept = java.import( TEMPLATE_EXCEPTION_HANDLER ).DEBUG_HANDLER;

   fmconfig.setDefaultEncodingSync( encoding );
   fmconfig.setLocaleSync( fmlocale );
   fmconfig.setOutputFormatSync( fmformat );
   fmconfig.setLogTemplateExceptionsSync( false );
   fmconfig.setTemplateLoaderSync( fmloader );
   fmconfig.setTemplateExceptionHandlerSync( fmexcept );

   return fmconfig;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function getTemplateLoaderImplementation( loaderContext, resourceLoaders ) {
   return {
      closeTemplateSource( obj ) {
      },
      findTemplateSource( name ) {
         const filename = path.resolve( loaderContext.context, name );
         loaderContext.addDependency( filename );

         try {
            const stat = loaderContext.fs.statSync( filename );
            return stat.isFile() ? filename : null;
         }
         catch( e ) {
            return null;
         }
      },
      getLastModified( obj ) {
         const stat = loaderContext.fs.statSync( obj );
         return LongIntToJava( stat.mtime.getTime() );
      },
      getReader( obj, encoding ) {
         const writer = java.newInstanceSync( PIPED_WRITER );
         const reader = java.newInstanceSync( PIPED_READER, writer );

         const done = err => {
            writer.closeSync();

            if( err ) {
               loaderContext.emitError( err );
            }
         };

         if( resourceLoaders.length ) {
            const request = '!!' + resourceLoaders.concat( [ obj ] ).join( '!' );
            loaderContext.loadModule( request, (err, source) => {
               if( err ) {
                  return done( err );;
               }

               try {
                  writer.write( loaderContext.exec( source, obj ), done );
               }
               catch( err ) {
                  done( err );
               }
            } );
         }
         else {
            loaderContext.fs.readFile( obj, (err, buf) => {
               if( err ) {
                  return done( err );
               }

               writer.write( buf.toString( encoding ), done );
            } );
         }

         return reader;
      }
   };
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function getLocale( locale ) {
   if( locale ) {
      return java.callStaticMethodSync( LOCALE, 'forLanguageTag', locale.replace( /_/g, '-' ) );
   }
   return java.callStaticMethodSync( LOCALE, 'getDefault' );
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function toJava( obj ) {
   if( obj === null || obj === undefined ) {
      return null;
   }
   if( typeof obj === 'string' || typeof obj === 'number' ) {
      return obj;
   }
   if( obj instanceof Date ) {
      return DateToJava( obj );
   }
   if( obj instanceof RegExp ) {
      return RegExpToJava( obj );
   }
   if( Array.isArray( obj ) ) {
      return ArrayToJava( obj );
   }
   if( typeof obj === 'object' ) {
      return ObjectToJava( obj );
   }
   if( typeof obj === 'function' ) {
      return FunctionToJava( obj );
   }
   return obj;
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function ArrayToJava( arr ) {
   const list = java.newInstanceSync( ARRAY_LIST, arr.length );
   arr.forEach( ( obj, index ) => {
      const value = toJava( obj );
      list.addSync( index, value );
   } );
   return list;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function ObjectToJava( obj ) {
   const map = java.newInstanceSync( HASH_MAP );
   Object.keys( obj ).forEach( key => {
      const value = toJava( obj[ key ] );
      map.putSync( key, value );
   } );
   return map;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function ErrorToJava( err ) {
   return java.newInstanceSync( EXCEPTION, err.message );
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function RegExpToJava( regexp ) {
   const Pattern = java.import( PATTERN );
   const flags =
      ( regexp.ignoreCase ? Pattern.CASE_INSENSITIVE : 0 ) |
      ( regexp.multiline ? Pattern.MULTILINE : 0 ) |
      ( regexp.unicode ? Pattern.UNICODE_CASE : 0 );
   return Pattern.compileSync( regexp.source, flags );
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function DateToJava( date ) {
   const timestamp = LongIntToJava( date.getTime() );
   return java.newInstanceSync( DATE, timestamp );
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function FunctionToJava( fn ) {
   if( fn.length === 0 ) {
      return java.newProxy( SUPPLIER, {
         get() {
            return toJava( fn() );
         }
      } );
   }
   if( fn.length === 1 ) {
      return java.newProxy( FUNCTION, {
         apply(x) {
            return toJava( fn(x) );
         }
      } );
   }
   if( fn.length === 2 ) {
      return java.newProxy( BI_FUNCTION, {
         apply(x, y) {
            return toJava( fn(x, y) );
         }
      } );
   }
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function LongIntToJava( num ) {
   return java.newInstanceSync( LONG, '' + num );
}
