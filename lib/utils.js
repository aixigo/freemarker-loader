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

const EXCEPTION = 'java.lang.Exception';
const LONG = 'java.lang.Long';
const STRING = 'java.lang.String';
const DATE = JAVA_UTIL + '.Date';
const LOCALE = JAVA_UTIL + '.Locale';

const PIPED_WRITER = JAVA_IO + '.PipedWriter';
const PIPED_READER = JAVA_IO + '.PipedReader';

const FREEMARKER_CORE = 'freemarker.core';
const FREEMARKER_TEMPLATE = 'freemarker.template';

const CONFIGURATION = FREEMARKER_TEMPLATE + '.Configuration';
const FALLBACK_FORMAT = FREEMARKER_CORE + '.UndefinedOutputFormat';
const OUTPUT_FORMATS = {
   css: FREEMARKER_CORE + '.CSSOutputFormat',
   html: FREEMARKER_CORE + '.HTMLOutputFormat',
   js: FREEMARKER_CORE + '.JavaScriptOutputFormat',
   json: FREEMARKER_CORE + '.JSONOutputFormat',
   rtf: FREEMARKER_CORE + '.RTFOutputFormat',
   txt: FREEMARKER_CORE + '.PlainTextOutputFormat',
   xhtml: FREEMARKER_CORE + '.XHTMLOutputFormat',
   xml: FREEMARKER_CORE + '.XMLOutputFormat'
};

const TEMPLATE_MODEL = FREEMARKER_TEMPLATE + '.TemplateModel';
const TEMPLATE_HASH_MODEL = FREEMARKER_TEMPLATE + '.TemplateHashModelEx';
const TEMPLATE_SEQUENCE_MODEL = FREEMARKER_TEMPLATE + '.TemplateSequenceModel';
const TEMPLATE_COLLECTION_MODEL = FREEMARKER_TEMPLATE + '.TemplateCollectionModelEx';
const TEMPLATE_MODEL_ITERATOR = FREEMARKER_TEMPLATE + '.TemplateModelIterator';
const TEMPLATE_METHOD_MODEL = FREEMARKER_TEMPLATE + '.TemplateMethodModel';

const TEMPLATE_BOOLEAN_MODEL = FREEMARKER_TEMPLATE + '.TemplateBooleanModel';
const TEMPLATE_DATE_MODEL = FREEMARKER_TEMPLATE + '.TemplateDateModel';
const TEMPLATE_NUMBER_MODEL = FREEMARKER_TEMPLATE + '.TemplateNumberModel';
const TEMPLATE_SCALAR_MODEL = FREEMARKER_TEMPLATE + '.TemplateScalarModel';

const TEMPLATE_MODEL_EXCEPTION = FREEMARKER_TEMPLATE + '.TemplateModelException';
const TEMPLATE_EXCEPTION_HANDLER = FREEMARKER_TEMPLATE + '.TemplateExceptionHandler';

const TEMPLATE_LOADER = 'freemarker.cache.TemplateLoader';

module.exports = {
   getModel( obj ) {
      return TemplateModel( obj, {} );
   },
   getLocale,
   getFreemarkerConfig,
   getTemplateLoaderImplementation
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

//////////////////////////////////////////////////////////////////////////////////////////////////////////////


