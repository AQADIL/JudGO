package service

import (
    "context"
    "log"
    "math/rand"
    "time"

    "github.com/google/uuid"

    "github.com/AQADIL/JudGO/internal/domain"
)

// MatchRepository is the port used by MatchService to persist matches.
type MatchRepository interface {
    Create(ctx context.Context, m *domain.Match) error
    Get(ctx context.Context, id string) (*domain.Match, error)
    Update(ctx context.Context, m *domain.Match) error
}

type MatchService struct {
    repo        MatchRepository
    botTickMax  int
    botTickStep time.Duration
}

func NewMatchService(repo MatchRepository) *MatchService {
    return &MatchService{
        repo:        repo,
        botTickMax:  20,
        botTickStep: 2 * time.Second,
    }
}                       

func (s *MatchService) CreateMatch(ctx context.Context, matchType, player1 string) (*domain.Match, error) {
    now := time.Now().UTC()
    m := &domain.Match{
        ID:     uuid.NewString(),
        Type:   domain.MatchType(matchType),
        Status: domain.MatchStatusPending,
        Player1: domain.PlayerResult{
            Name:  player1,
            Score: 0,
        },
        CreatedAt: now,
        UpdatedAt: now,
    }

    if m.Type == domain.MatchTypeBot {
        m.Status = domain.MatchStatusRunning
    }

    if err := s.repo.Create(ctx, m); err != nil {
        return nil, err
    }

    if m.Type == domain.MatchTypeBot {
        go s.runBotLogic(m.ID)
    }

    return m, nil
}

func (s *MatchService) JoinMatch(ctx context.Context, matchID, player2 string) (*domain.Match, error) {
    m, err := s.repo.Get(ctx, matchID)
    if err != nil {
        return nil, err
    }

    if m.Player2 != nil {
        return m, nil
    }

    m.Player2 = &domain.PlayerResult{Name: player2}
    m.Status = domain.MatchStatusRunning
    m.UpdatedAt = time.Now().UTC()

    if err := s.repo.Update(ctx, m); err != nil {
        return nil, err
    }

    return m, nil
}

// UpdateScore is used by handlers and bot-logic to mutate a player's score.
func (s *MatchService) UpdateScore(ctx context.Context, matchID, player string, delta int, finish bool) (*domain.Match, error) {
    m, err := s.repo.Get(ctx, matchID)
    if err != nil {
        return nil, err
    }

    if m.Player1.Name == player {
        m.Player1.Score += delta
    } else if m.Player2 != nil && m.Player2.Name == player {
        m.Player2.Score += delta
    }

    if finish {
        m.Status = domain.MatchStatusFinished
    }

    m.UpdatedAt = time.Now().UTC()

    if err := s.repo.Update(ctx, m); err != nil {
        return nil, err
    }

    return m, nil
}

func (s *MatchService) GetMatch(ctx context.Context, id string) (*domain.Match, error) {
    return s.repo.Get(ctx, id)
}

// runBotLogic periodically increments the bot player's score until the
// match is finished or a maximum number of ticks is reached.
func (s *MatchService) runBotLogic(matchID string) {
    ctx := context.Background()
    ticker := time.NewTicker(s.botTickStep)
    defer ticker.Stop()

    for i := 0; i < s.botTickMax; i++ {
        <-ticker.C

        m, err := s.repo.Get(ctx, matchID)
        if err != nil {
            log.Printf("[BOT] failed to load match %s: %v", matchID, err)
            return
        }

        if m.Status == domain.MatchStatusFinished {
            log.Printf("[BOT] match %s finished, stopping bot", matchID)
            return
        }

        if m.Player2 == nil {
            m.Player2 = &domain.PlayerResult{Name: "Bot"}
        }

        m.Player2.Score += rand.Intn(11) // +0..10 points
        m.UpdatedAt = time.Now().UTC()

        if err := s.repo.Update(ctx, m); err != nil {
            log.Printf("[BOT] failed to update match %s: %v", matchID, err)
            return
        }
    }

    log.Printf("[BOT] reached max ticks for match %s, stopping bot", matchID)
}
