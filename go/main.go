package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/awslabs/aws-lambda-go-api-proxy/gorillamux"
	"github.com/gorilla/mux"
)

const (
	DEFAULT_SERVICE_NAME string = "gorillamux"
	DEFAULT_VERSION      string = "1.0"
)

var r *mux.Router
var adapter *gorillamux.GorillaMuxAdapter

func init() {
	r = mux.NewRouter()
	// catch everything
	r.PathPrefix("/").HandlerFunc(HomeHandler)
	adapter = gorillamux.New(r)
}

func main() {
	if isInLambda() {
		lambda.Start(LambdaHandler)
	} else {
		listenOn := "0.0.0.0:8080"
		log.Printf("Start listening on http://%v", listenOn)
		log.Fatal(http.ListenAndServe(listenOn, r))
	}
}

func HomeHandler(w http.ResponseWriter, r *http.Request) {
	serviceName := getEnvOrDefault("serviceName", DEFAULT_SERVICE_NAME)
	versionNum := getEnvOrDefault("versionNum", DEFAULT_VERSION)
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"serviceName": serviceName, "versionNum": versionNum})
}

func LambdaHandler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	return adapter.ProxyWithContext(context.Background(), req)
}

func getEnvOrDefault(e string, d string) string {
	if v, ok := os.LookupEnv(e); ok {
		return v
	}
	return d
}

func isInLambda() bool {
	return os.Getenv("AWS_LAMBDA_RUNTIME_API") != ""
}
