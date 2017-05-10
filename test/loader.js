/**
 * Copyright 2017 aixigo AG
 * Released under the MIT license.
 * https://opensource.org/licenses/MIT
 */

'use strict';

const fs = require( 'fs' );
const expect = require( 'chai' ).expect;
const loader = require( '..' );

describe( 'freemarker-loader', () => {

   it('should process templates', done => {
      callLoader({
         query: '?template=index.html&classpath=freemarker.jar',
         inputValue: { test: 123 },
         callback( err, result ) {
            if( err ) {
               done( err );
               return;
            }

            expect( result ).to.equal( '<em>123</em>\n' );
            done();
         }
      });
   });

   it('should declare dependencies', done => {
      let dependencies = [];
      callLoader({
         query: '?template=index.html&classpath=freemarker.jar',
         inputValue: { test: 123 },
         addDependency( dep ) {
            dependencies.push( dep );
         },
         callback( err, result ) {
            if( err ) {
               done( err );
               return;
            }

            expect( dependencies ).to.eql( [
               'index_en_US.html',
               'index_en.html',
               'index.html'
            ].map( file => __dirname + '/' + file ) );
            done();
         }
      });
   });

   function callLoader( options, source ) {
      loader.call( Object.assign({
         context: __dirname,
         resourcePath: __dirname + '/test.json',
         fs,
         cacheable() {},
         async() {},
         addDependency() {}
      }, options), source );
   }

});
