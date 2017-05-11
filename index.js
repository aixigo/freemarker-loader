/**
 * Copyright 2017 aixigo AG
 * Released under the MIT license.
 * https://opensource.org/licenses/MIT
 */

'use strict';

const path = require( 'path' );
const java = require( 'java' );
const loaderUtils = require( 'loader-utils' );
const utils = require( './lib/utils' );

const STRING_READER = 'java.io.StringReader';
const STRING_WRITER = 'java.io.StringWriter';
const TEMPLATE = 'freemarker.template.Template';

module.exports = function () {
   throw new Error( 'This is a pitching loader…' );
};

module.exports.pitch = function (remainingRequest) {
   const options = loaderUtils.getOptions( this );
   const classpath = Array.isArray( options.classpath ) ? options.classpath : [ options.classpath ];

   const resourceLoaders = remainingRequest.split( '!' );

   if( resourceLoaders.pop() !== this.resourcePath ) {
      this.callback( new Error( 'Expected remaining request to end with resource path "' + this.resourcePath + '"' ) );
      return;
   }

   const data = options.data;

   this.cacheable();
   this.async();

   if( !java.isJvmCreated() ) {
      java.registerClient( () => {
         classpath.forEach( cp => {
            if( cp ) {
               java.classpath.push( path.resolve( this.context, cp ) );
            }
         } );
      } );
   }

   java.ensureJvm( () => {
      let fmwriter;
      let fmconfig;
      let fmtemplate;

      try {
         fmwriter = java.newInstanceSync( STRING_WRITER );
         fmconfig = utils.getFreemarkerConfig( this, options, resourceLoaders );
      }
      catch( err ) {
         this.callback( err );
         return;
      }


      utils.pipe( [
         ( callback ) => {
            fmconfig.getTemplate( path.relative( this.context, this.resourcePath ), callback );
         },
         ( template, callback ) => {
            fmtemplate = template;
            this.loadModule( data, callback );
         },
         ( source, callback ) => {
            try {
               const fmdata = utils.toJava( this.exec( source, data ) );
               fmtemplate.process( fmdata, fmwriter, callback );
            }
            catch( err ) {
               callback( err );
            }
         },
         ( callback ) => {
            fmwriter.toString( callback );
         },
      ], this.callback );
   } );
};

