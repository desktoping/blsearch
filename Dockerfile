FROM node:argon

MAINTAINER Reden <reden@armstead.io>

RUN apt-get update && apt-get install \
  git

ADD . ./

RUN npm install