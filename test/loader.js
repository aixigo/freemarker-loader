/**
 * Copyright 2017 aixigo AG
 * Released under the MIT license.
 * https://opensource.org/licenses/MIT
 */

'use strict';

const fs = require( 'fs' );
const path = require( 'path' );
const expect = require( 'chai' ).expect;
const loader = require( '..' );

describe( 'freemarker-loader', () => {

   it( 'runs in the pitching phase', done => {
      pitchLoader( {
         query: '?data=data.js&classpath=freemarker.jar',
      }, __dirname + '/index.html', done );
   } );

   function pitchLoader( options, request, done ) {
      loader.pitch.call( Object.assign( {
         context: __dirname,
         resourcePath: request.split( '!' ).pop(),
         fs,
         cacheable() {},
         async() {},
         addDependency() {},
         loadModule( request, callback ) {
            const filename = path.resolve( this.context, request );
            fs.readFile( filename, callback );
         },
         exec( source ) {
            const fn = new Function( 'module', 'exports', source );
            const module = {
               exports: {}
            };
            fn( module, module.exports );
            return module.exports;
         },
         callback( err, source ) {
            done( err );
         }
      }, options ), request, '', {} );
   }

});
