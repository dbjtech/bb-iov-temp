FROM node:alpine
RUN apk add tzdata --update --no-cache && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && echo "Asia/Shanghai" /etc/localtime && apk del tzdata

COPY . /app
WORKDIR /app

RUN npm i --production

CMD node . --app-name="bb-iov-temp"

EXPOSE 80
