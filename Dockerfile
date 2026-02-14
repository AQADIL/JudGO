# syntax=docker/dockerfile:1

FROM golang:1.23-alpine AS build
WORKDIR /app

RUN apk add --no-cache git ca-certificates

COPY go.mod go.sum ./
RUN go mod download

COPY . ./

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /app/judgo-api ./cmd/api


FROM alpine:3.20
WORKDIR /app

RUN apk add --no-cache ca-certificates

COPY --from=build /app/judgo-api ./judgo-api

ENV PORT=8080
EXPOSE 8080

CMD ["./judgo-api"]
