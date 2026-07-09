FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
COPY . .
RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -o /game-server .

FROM alpine:3.20
RUN adduser -D -u 10001 game
WORKDIR /app
COPY --from=build /game-server /app/game-server
RUN mkdir -p /app/data && chown -R game:game /app
USER game
EXPOSE 8081
CMD ["/app/game-server"]

