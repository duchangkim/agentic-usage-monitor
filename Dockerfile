FROM oven/bun:1.1-alpine

WORKDIR /workspace

RUN apk add --no-cache git bash

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .

ENV NODE_ENV=development

CMD ["bun", "run", "typecheck"]
