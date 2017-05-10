/**
 * Copyright 2017 aixigo AG
 * Released under the MIT license.
 * https://opensource.org/licenses/MIT
 */

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

module.exports = {
   pipe,
   toJava,
   getLocale,
   templateLoaderImplementation
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function pipe( fns, callback ) {
   const stack = fns.slice();

   iterate( null );

   function iterate( err, ...args ) {
      const fn = stack.shift();

      if( err || !fn ) {
         callback( err, ...args );
      }
      else {
         fn( ...args.slice( 0, fn.length - 1 ), iterate );
      }
   }
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function templateLoaderImplementation( loaderContext ) {
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

         loaderContext.fs.readFile( obj, (err, buf) => {
            if( err ) {
               loaderContext.emitError( err );
               writer.closeSync();
               return;
            }

            writer.write( buf.toString( encoding ), err => {
               writer.closeSync();

               if( err ) {
                  loaderContext.emitError( err );
                  return;
               }
            } );
         } );

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
