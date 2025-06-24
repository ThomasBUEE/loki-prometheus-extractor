# Tests

Ce dossier contient tous les tests pour le projet Loki-Prometheus Extractor.

## Structure des Tests

```
tests/
├── setup.ts                 # Configuration globale des tests
├── integration.test.ts      # Tests d'intégration end-to-end
├── constants.test.ts        # Tests des constantes de l'application
├── errors.test.ts          # Tests des classes d'erreurs personnalisées
├── date-utils.test.ts      # Tests des utilitaires de date
├── json-utils.test.ts      # Tests des utilitaires JSON
├── data-aggregator.test.ts # Tests de l'agrégateur de données
├── field-extractor.test.ts # Tests de l'extracteur de champs
└── data-filter.test.ts     # Tests du service de filtrage
```

## Commandes de Test

### Tests de Base
```bash
# Exécuter tous les tests
npm test

# Exécuter les tests en mode watch
npm run test:watch

# Exécuter les tests avec couverture
npm run test:coverage
```

### Tests Spécialisés
```bash
# Tests unitaires seulement (excluant les tests d'intégration)
npm run test:unit

# Tests d'intégration seulement
npm run test:integration

# Exécuter un fichier de test spécifique
npm test -- date-utils.test.ts
```

## Types de Tests

### 1. Tests Unitaires
Tests isolés pour chaque module/classe :
- **date-utils.test.ts** : Fonctions de manipulation de dates
- **json-utils.test.ts** : Utilitaires pour JSON et objets
- **data-aggregator.test.ts** : Logique d'agrégation de données
- **field-extractor.test.ts** : Extraction de champs depuis JSON
- **data-filter.test.ts** : Filtrage de données
- **errors.test.ts** : Classes d'erreurs personnalisées
- **constants.test.ts** : Validation des constantes

### 2. Tests d'Intégration
Tests end-to-end du pipeline complet :
- **integration.test.ts** : Pipeline complet depuis les données brutes jusqu'au CSV

## Couverture de Test

Les tests couvrent :
- ✅ **Logique métier** : Toutes les fonctions d'agrégation, extraction, filtrage
- ✅ **Gestion d'erreurs** : Scénarios d'erreur et récupération
- ✅ **Cas limites** : Données vides, malformées, valeurs nulles
- ✅ **Intégration** : Pipeline complet de traitement
- ✅ **Performance** : Tests avec des datasets modérément larges

## Configuration Jest

Le projet utilise Jest avec ts-jest pour les tests TypeScript :

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts'
  ]
};
```

## Écriture de Nouveaux Tests

### Structure d'un Test Unitaire
```typescript
import { FunctionToTest } from '../src/module';

describe('ModuleName', () => {
  describe('functionName', () => {
    it('should handle normal case', () => {
      const result = FunctionToTest('input');
      expect(result).toBe('expected');
    });

    it('should handle edge case', () => {
      expect(() => FunctionToTest(null)).toThrow();
    });
  });
});
```

### Bonnes Pratiques
1. **Descriptif** : Noms de tests clairs et descriptifs
2. **Isolation** : Chaque test doit être indépendant
3. **AAA Pattern** : Arrange, Act, Assert
4. **Edge Cases** : Tester les cas limites et erreurs
5. **Mocking** : Utiliser des mocks pour les dépendances externes

## Mocking

Le projet utilise des mocks pour :
- **Console** : Les sorties console sont mockées dans setup.ts
- **File System** : Pour les tests CSV (dans les tests d'intégration)
- **Dates** : Dates fixes pour les tests temporels

## CI/CD

Les tests sont exécutés automatiquement lors :
- **Push/Pull Request** : Tous les tests unitaires
- **Release** : Tests complets avec couverture
- **Nightly** : Tests d'intégration étendus

## Debugging des Tests

### Mode Debug
```bash
# Exécuter avec plus de détails
npm test -- --verbose

# Exécuter un seul test en mode debug
npm test -- --testNamePattern="specific test name"
```

### Variables d'Environnement
```bash
# Activer les logs de debug dans les tests
DEBUG=1 npm test

# Conserver les fichiers de test temporaires
KEEP_TEST_FILES=1 npm test
```

## Métriques de Qualité

### Objectifs de Couverture
- **Statements** : > 90%
- **Branches** : > 85%
- **Functions** : > 90%
- **Lines** : > 90%

### Seuils d'Alerte
- **Temps d'exécution** : Tests unitaires < 5s, Intégration < 30s
- **Taille mémoire** : < 100MB pour tous les tests
- **Flaky tests** : 0 tolérance pour les tests instables
