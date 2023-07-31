# NOTICE: Makefile on kirjoitettu itse.

SRC := index.html main.js public/target.glb

all: dist test

deps: node_modules

node_modules:
	npm install

init:
	npm init -y
	npm install --save three
	npm install --save-dev vite

test: deps
	npx vite

dist: deps $(SRC)
	npx vite build --assetsDir ./ --base ./
