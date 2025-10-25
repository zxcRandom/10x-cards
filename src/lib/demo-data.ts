/**
 * Demo Data - Mock data for testing UI without backend
 */

import type { DeckDTO, AIDeckResponseDTO } from '@/types';

export const DEMO_MODE = import.meta.env.PUBLIC_DEMO_MODE === 'true';

export const mockDecks: DeckDTO[] = [
  {
    id: '1',
    name: 'Historia Polski',
    createdByAi: true,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    name: 'React Hooks',
    createdByAi: true,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    name: 'TypeScript Basics',
    createdByAi: false,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    name: 'Tailwind CSS',
    createdByAi: true,
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5',
    name: 'Node.js Fundamentals',
    createdByAi: false,
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '6',
    name: 'SQL Queries',
    createdByAi: true,
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export function generateMockAIResponse(inputText: string, deckName?: string, maxCards?: number): AIDeckResponseDTO {
  const cardsCount = Math.min(maxCards || 5, 5); // Generate 5 cards for demo
  const cards = [];

  for (let i = 0; i < cardsCount; i++) {
    cards.push({
      id: `demo-card-${i + 1}`,
      question: `Przykładowe pytanie ${i + 1} z tekstu`,
      answer: `Przykładowa odpowiedź ${i + 1} wygenerowana przez AI`,
    });
  }

  return {
    deck: {
      id: `demo-deck-${Date.now()}`,
      name: deckName || `Demo Deck - ${new Date().toLocaleDateString()}`,
      createdByAi: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    cards,
    log: {
      id: `demo-log-${Date.now()}`,
      deckId: `demo-deck-${Date.now()}`,
      inputTextLength: inputText.length,
      generatedCardsCount: cardsCount,
      errorMessage: null,
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Mock data for review view testing
 */
export const mockReviewData = {
  deck: {
    id: 'demo-deck-review',
    name: 'React Hooks - wygenerowane przez AI',
    createdByAi: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  cards: [
    {
      id: 'card-1',
      question: 'Czym jest hook useState w React?',
      answer: 'useState to hook, który pozwala na zarządzanie stanem lokalnym komponentu funkcyjnego. Zwraca tablicę z wartością stanu i funkcją do jego aktualizacji.',
    },
    {
      id: 'card-2',
      question: 'Do czego służy hook useEffect?',
      answer: 'useEffect pozwala na wykonywanie efektów ubocznych w komponentach funkcyjnych, takich jak pobieranie danych, subskrypcje czy manipulacja DOM.',
    },
    {
      id: 'card-3',
      question: 'Jak działa hook useContext?',
      answer: 'useContext pozwala na dostęp do wartości z React Context bez potrzeby używania Consumer. Przyjmuje obiekt context i zwraca jego aktualną wartość.',
    },
    {
      id: 'card-4',
      question: 'Kiedy użyć useCallback?',
      answer: 'useCallback służy do memoizacji funkcji callback, aby zapobiec niepotrzebnym re-renderowaniom komponentów potomnych, które otrzymują te funkcje jako props.',
    },
    {
      id: 'card-5',
      question: 'Czym różni się useMemo od useCallback?',
      answer: 'useMemo memoizuje wynik obliczeń, podczas gdy useCallback memoizuje samą funkcję. useMemo zwraca wartość, a useCallback zwraca funkcję.',
    },
    {
      id: 'card-6',
      question: 'Co to jest useRef?',
      answer: 'useRef tworzy mutableny obiekt ref, który zachowuje swoją wartość między renderowaniami. Często używany do dostępu do elementów DOM lub przechowywania wartości, które nie powinny wywoływać re-renderu.',
    },
  ],
};
