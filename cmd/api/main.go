package main

import (
  "fmt"
  "log"
  "net/http"
  "os"
  "time"

  firebaseRepo "github.com/AQADIL/JudGO/internal/repository/firebase"
  "github.com/AQADIL/JudGO/internal/service"
  "github.com/AQADIL/JudGO/internal/transport/rest"
  firebaseClient "github.com/AQADIL/JudGO/pkg/client/firebase"
)

func main() {
  printBanner()

  log.Println("[INIT] Loading configuration...")
  log.Println("[INIT] Connecting to Firebase RTDB...")
  db, err := firebaseClient.InitDB("config/serviceAccountKey.json", "https://judgo-2726f-default-rtdb.europe-west1.firebasedatabase.app/")
  if err != nil {
    log.Fatalf("[ERROR] Unable to init Firebase: %v", err)
  }
  log.Println("Connected to Firebase")

  log.Println("[INIT] Initializing Repository, Service, and Transport layers...")
  matchRepo := firebaseRepo.NewFirebaseMatchRepository(db)
  matchService := service.NewMatchService(matchRepo)
  handler := rest.NewHandler(matchService)
  rest.RegisterRoutes(http.DefaultServeMux, handler)

  port := "8080"
  if envPort := os.Getenv("PORT"); envPort != "" {
    port = envPort
  }

  http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusOK)
    w.Write([]byte(`{"status": "alive", "project": "JudGO", "time": "` + time.Now().String() + `"}`))
  })

  log.Printf("[READY] JudGO Server is running on http://localhost:%s\n", port)

  if err := http.ListenAndServe(":"+port, nil); err != nil {
    log.Fatalf("[ERROR] Server failed to start: %v", err)
  }
}

func printBanner() {
  fmt.Println(`
       __          __  __________ 
      / /_  ______/ / / ____/ __ \
 __  / / / / / __  / / / __/ / / /
/ /_/ / /_/ / /_/ / / /_/ / /_/ / 
\____/\__,_/\__,_/  \____/\____/  
                                  
   >> Go Contester Platform | Backend  
  `)
}