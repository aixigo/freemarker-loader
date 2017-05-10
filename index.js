/**
 * Copyright 2017 aixigo AG
 * Released under the MIT license.
 * https://opensource.org/licenses/MIT
 */

const path = require( 'path' );
const java = require( 'java' );
const loaderUtils = require( 'loader-utils' );
const utils = require( './lib/utils' );

const STRING_WRITER = 'java.io.StringWriter';
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

module.exports = function (code) {
   const options = loaderUtils.getOptions( this );
   const template = options.template || 'index.html';
   const classpath = options.classpath || [ 'target/dependency' ];
   const format = options.format || path.extname( template ).substr( 1 );
   const encoding = options.encoding || 'UTF-8';
   const locale = options.locale;

   this.cacheable();
   this.async();

   java.registerClient( () => {
      classpath.forEach( cp => { java.classpath.pushDir( cp ) } );
   } );

   java.ensureJvm( () => {
      const fmconfig = java.newInstanceSync( CONFIGURATION );
      const fmdata = utils.toJava( this.inputValue || this.exec( code, this.resourcePath ) );

      const fmformat = java.import( OUTPUT_FORMATS[ format ] || FALLBACK_FORMAT ).INSTANCE;
      const fmloader = java.newProxy( TEMPLATE_LOADER,
         utils.templateLoaderImplementation( this ) );
      const fmlocale = utils.getLocale( locale );
      const fmexcept = java.import( TEMPLATE_EXCEPTION_HANDLER ).DEBUG_HANDLER;
      const fmwriter = java.newInstanceSync( STRING_WRITER );

      fmconfig.setDefaultEncodingSync( encoding );
      fmconfig.setLocaleSync( fmlocale );
      fmconfig.setOutputFormatSync( fmformat );
      fmconfig.setLogTemplateExceptionsSync( false );
      fmconfig.setTemplateLoaderSync( fmloader );
      fmconfig.setTemplateExceptionHandlerSync( fmexcept );

      utils.pipe( [
         ( callback ) => fmconfig.getTemplate( template, callback ),
         ( fmtemplate, callback ) => fmtemplate.process( fmdata, fmwriter, callback ),
         ( callback ) => fmwriter.toString( callback ),
         ( str, callback ) => callback( null, 'module.exports = ' + JSON.stringify( str ) + ';' )
      ], this.callback );
   } );
};
