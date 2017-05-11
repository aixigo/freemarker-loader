/**
 * Copyright 2017 aixigo AG
 * Released under the MIT license.
 * https://opensource.org/licenses/MIT
 */

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
      'use strict';
      let fmconfig;
      let templateName;
      let templateSourceName;
      let templateSource;

      try {
         fmconfig = utils.getFreemarkerConfig( this, options );
      }
      catch( err ) {
         this.callback( err );
         return;
      }


      utils.pipe( [
         ( callback ) => {
            fmconfig.getTemplate( path.relative( this.context, this.resourcePath ), callback );
         },
         ( fmtemplate, callback ) => {
            templateName = fmtemplate.getNameSync();
            templateSourceName = fmtemplate.getSourceNameSync();

            const resourcePath = path.join( this.context, templateSourceName );
            const resolvedRequest = resourceLoaders.concat( [ resourcePath ] ).join( '!' );
            this.loadModule( resolvedRequest, callback );
         },
         ( source, callback ) => {
            templateSource = this.exec( source, this.resourcePath );
            this.loadModule( data, callback );
         },
         ( source, callback ) => {
            const fmdata = utils.toJava( this.exec( source, data ) );
            const fmreader = java.newInstanceSync( STRING_READER, templateSource );
            const fmwriter = java.newInstanceSync( STRING_WRITER );
            const fmtemplate = java.newInstanceSync( TEMPLATE, templateName, templateSourceName, fmreader, fmconfig );

            fmtemplate.process( fmdata, fmwriter, () => {
               fmwriter.toString( callback );
            } );
         }
      ], this.callback );
   } );
};

