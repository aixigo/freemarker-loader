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
const STRING = 'java.lang.String';
const DATE = JAVA_UTIL + '.Date';
const LOCALE = JAVA_UTIL + '.Locale';

const PIPED_WRITER = JAVA_IO + '.PipedWriter';
const PIPED_READER = JAVA_IO + '.PipedReader';

const FREE_MARKER_CORE = 'freemarker.core';
const FREE_MARKER_TEMPLATE = 'freemarker.template';

const CONFIGURATION = FREE_MARKER_TEMPLATE + '.Configuration';
const FALLBACK_FORMAT = FREE_MARKER_CORE + '.UndefinedOutputFormat';
const OUTPUT_FORMATS = {
   css: FREE_MARKER_CORE + '.CSSOutputFormat',
   html: FREE_MARKER_CORE + '.HTMLOutputFormat',
   js: FREE_MARKER_CORE + '.JavaScriptOutputFormat',
   json: FREE_MARKER_CORE + '.JSONOutputFormat',
   rtf: FREE_MARKER_CORE + '.RTFOutputFormat',
   txt: FREE_MARKER_CORE + '.PlainTextOutputFormat',
   xhtml: FREE_MARKER_CORE + '.XHTMLOutputFormat',
   xml: FREE_MARKER_CORE + '.XMLOutputFormat'
};

const TEMPLATE_MODEL = FREE_MARKER_TEMPLATE + '.TemplateModel';
const TEMPLATE_HASH_MODEL = FREE_MARKER_TEMPLATE + '.TemplateHashModelEx';
const TEMPLATE_SEQUENCE_MODEL = FREE_MARKER_TEMPLATE + '.TemplateSequenceModel';
const TEMPLATE_COLLECTION_MODEL = FREE_MARKER_TEMPLATE + '.TemplateCollectionModelEx';
const TEMPLATE_MODEL_ITERATOR = FREE_MARKER_TEMPLATE + '.TemplateModelIterator';
const TEMPLATE_METHOD_MODEL = FREE_MARKER_TEMPLATE + '.TemplateMethodModel';

const TEMPLATE_BOOLEAN_MODEL = FREE_MARKER_TEMPLATE + '.TemplateBooleanModel';
const TEMPLATE_DATE_MODEL = FREE_MARKER_TEMPLATE + '.TemplateDateModel';
const TEMPLATE_NUMBER_MODEL = FREE_MARKER_TEMPLATE + '.TemplateNumberModel';
const TEMPLATE_SCALAR_MODEL = FREE_MARKER_TEMPLATE + '.TemplateScalarModel';

const TEMPLATE_MODEL_EXCEPTION = FREE_MARKER_TEMPLATE + '.TemplateModelException';
const TEMPLATE_EXCEPTION_HANDLER = FREE_MARKER_TEMPLATE + '.TemplateExceptionHandler';

const TEMPLATE_LOADER = 'freemarker.cache.TemplateLoader';

module.exports = {
   getModel( obj ) {
      return TemplateModel( obj, {} );
   },
   getLocale,
   getFreeMarkerConfig,
   getTemplateLoaderImplementation
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function getFreeMarkerConfig( loaderContext, options, baseDirectory ) {
   const encoding = options.encoding || 'UTF-8';
   const locale = options.locale;
   const format = options.format || path.extname( loaderContext.resourcePath ).substr( 1 );

   const fmConfig = java.newInstanceSync( CONFIGURATION );

   const fmFormat = java.import( OUTPUT_FORMATS[ format ] || FALLBACK_FORMAT ).INSTANCE;
   const fmLoader = java.newProxy(
      TEMPLATE_LOADER,
      getTemplateLoaderImplementation( loaderContext, baseDirectory )
   );
   const fmLocale = getLocale( locale );
   const fmExcept = java.import( TEMPLATE_EXCEPTION_HANDLER ).DEBUG_HANDLER;

   fmConfig.setDefaultEncodingSync( encoding );
   fmConfig.setLocaleSync( fmLocale );
   fmConfig.setOutputFormatSync( fmFormat );
   fmConfig.setLogTemplateExceptionsSync( false );
   fmConfig.setTemplateLoaderSync( fmLoader );
   fmConfig.setTemplateExceptionHandlerSync( fmExcept );

   return fmConfig;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function getTemplateLoaderImplementation( loaderContext, baseDirectory ) {
   return {
      closeTemplateSource() {
      },
      findTemplateSource( name ) {
         const filename = path.resolve( baseDirectory, name );
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
         const num = stat.mtime.getTime();
         return java.newInstanceSync( LONG, '' + num );
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

         loaderContext.fs.readFile( obj, ( err, buf ) => {
            if( err ) {
               done( err );
               return;
            }

            writer.write( buf.toString( encoding ), done );
         } );

         return reader;
      }
   };
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function getLocale( locale ) {
   if( locale ) {
      return java.callStaticMethodSync( LOCALE, 'forLanguageTag', locale.replace( /_/g, '-' ) );
   }
   return java.callStaticMethodSync( LOCALE, 'getDefault' );
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function TemplateModel( obj, parent ) {
   if( obj === null || obj === undefined ) {
      return java.getStaticFieldValue( TEMPLATE_MODEL, 'NOTHING' );
   }
   if( Array.isArray( obj ) ) {
      return TemplateSequenceModel( obj, parent );
   }
   if( obj instanceof Date ) {
      return TemplateDateModel( obj, parent );
   }
   if( typeof obj === 'boolean' ) {
      return TemplateBooleanModel( obj, parent );
   }
   if( typeof obj === 'number' ) {
      return TemplateNumberModel( obj, parent );
   }
   if( typeof obj === 'string' ) {
      return TemplateScalarModel( obj, parent );
   }
   if( typeof obj === 'function' ) {
      return TemplateMethodModel( obj, parent );
   }
   if( typeof obj === 'object' ) {
      return TemplateHashModel( obj, parent );
   }
   throw TemplateModelException( 'No mapping for ' + obj );
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function TemplateModelException( message ) {
   return java.newInstanceSync( TEMPLATE_MODEL_EXCEPTION, message );
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function TemplateHashModel( obj ) {
   const keys = Object.keys( obj );
   return java.newProxy( TEMPLATE_HASH_MODEL, {
      get( key ) {
         return TemplateModel( obj[ key ], obj );
      },
      isEmpty() {
         return keys.length === 0;
      },
      keys() {
         return TemplateCollectionModel( keys );
      },
      values() {
         return TemplateCollectionModel( keys.map( k => obj[ k ] ) );
      },
      size() {
         return keys.length;
      }
   } );
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function TemplateSequenceModel( obj ) {
   return java.newProxy( TEMPLATE_SEQUENCE_MODEL, {
      get( i ) {
         if( i < obj.length ) {
            return TemplateModel( obj[ i ], obj );
         }
         throw TemplateModelException();
      },
      size() {
         return obj.length;
      }
   } );
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function TemplateCollectionModel( obj ) {
   return java.newProxy( TEMPLATE_COLLECTION_MODEL, {
      iterator() {
         return TemplateIteratorModel( obj );
      },
      isEmpty() {
         return obj.length === 0;
      },
      size() {
         return obj.length;
      }
   } );
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function TemplateIteratorModel( obj, parent ) {
   const get = parent ?
      k => parent[ k ] :
      k => k;

   let i = 0;
   return java.newProxy( TEMPLATE_MODEL_ITERATOR, {
      next() {
         if( i < obj.length ) {
            return TemplateModel( get( obj[ i++ ] ), parent || obj );
         }
         throw TemplateModelException();
      },
      hasNext() {
         return i < obj.length;
      }
   } );
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function TemplateMethodModel( obj, parent ) {
   return java.newProxy( TEMPLATE_METHOD_MODEL, {
      exec( args ) {
         const a = [];
         const size = args.size();
         for( let i = 0; i < size; i++ ) {
            a[ i ] = args.getSync( i );
         }
         return TemplateModel( obj.apply( parent, a ) );
      }
   } );
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function TemplateBooleanModel( obj ) {
   return java.getStaticFieldValue( TEMPLATE_BOOLEAN_MODEL, obj ? 'TRUE' : 'FALSE' );
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function TemplateDateModel( obj ) {
   return java.newProxy( TEMPLATE_DATE_MODEL, {
      getAsDate() {
         const timestamp = java.newInstanceSync( LONG, '' + obj.getTime() );
         return java.newInstanceSync( DATE, timestamp );
      },
      getDateType() {
         return java.getStaticFieldValue( TEMPLATE_DATE_MODEL, 'UNKNOWN' );
      }
   } );
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function TemplateNumberModel( obj ) {
   return java.newProxy( TEMPLATE_NUMBER_MODEL, {
      getAsNumber() {
         return obj;
      }
   } );
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function TemplateScalarModel( obj ) {
   return java.newProxy( TEMPLATE_SCALAR_MODEL, {
      getAsString() {
         return java.newInstanceSync( STRING, obj );
      }
   } );
}
