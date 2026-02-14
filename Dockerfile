FROM golang:1.24-alpine AS builder

WORKDIR /app
RUN apk add --no-cache git
COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o /bin/judgo ./cmd/api/main.go


FROM golang:1.24-alpine

WORKDIR /app

RUN apk add --no-cache \
    python3 \
    bash \
    ca-certificates \
    tzdata

ENV TZ=Asia/Almaty

RUN adduser -D -g '' judgo_user

COPY --from=builder /bin/judgo /app/judgo

RUN mkdir -p /app/config && \
    chown -R judgo_user:judgo_user /app

USER judgo_user

ENV PORT=8080
EXPOSE 8080

CMD ["/app/judgo"]