# VoiceChat - Випадковий Голосовий Чат

## Project Overview
- **Назва**: VoiceChat
- **Тип**: Веб-додаток для випадкового голосового спілкування
- **Функціонал**: Анонімний голосовий чат з випадковим співрозмовником
- **Цільова аудиторія**: Люди, які хочуть познайомитися з новими людьми

## UI/UX Specification

### Layout Structure
- **Сторінки**:
  - `/` - Головна (авторизація)
  - `/app` - Основний інтерфейс чату
- **Структура**: Центрований контент, max-width 480px

### Visual Design
- **Кольори**:
  - Background: `#0a0a0f` (темно-синій чорний)
  - Surface: `#14141f` (картки)
  - Primary: `#7c3aed` (фіолетовий)
  - Primary Hover: `#8b5cf6`
  - Accent: `#22c55e` (зелений для онлайн)
  - Text Primary: `#f8fafc`
  - Text Secondary: `#94a3b8`
  - Border: `#1e1e2e`
  - Error: `#ef4444`
- **Типографіка**:
  - Font: `'Inter', sans-serif`
  - Heading: 24px bold
  - Body: 14px regular
  - Small: 12px
- **Відступи**: 16px базові
- **Бордери**: 12px border-radius
- **Тіні**: `0 4px 24px rgba(124, 58, 237, 0.15)`

### Components
1. **Input** - темний інпут з бордером
2. **Button** - primary (фіолетовий), secondary (сірий)
3. **Avatar** - коло з першою літерою ніку
4. **Badge** - галочка ✔ для verified
5. **Status Indicator** - зелена крапка для онлайн

### Responsive
- Mobile first
- Max-width: 480px
- Center on larger screens

## Functionality Specification

### Authentication
- Email/password реєстрація
- Вхід існуючих користувачів
- Створення унікального ніку при реєстрації
- Перевірка унікальності ніку в Firestore

### User Data (Firestore)
```
collection: users
  document: {uid}
    - nickname: string
    - verified: boolean (default: false)
    - createdAt: timestamp
    - isOnline: boolean
    - lastSeen: timestamp
```

### Chat Logic
1. Користувач натискає "Знайти"
2. Система шукає іншого онлайн користувача, який також шукає
3. Створюється пара
4. Встановлюється WebRTC з'єднання
5. Показується ніка співрозмовника
6. Кнопки: "Наступний", "Вийти", "Викл/Вкл мікрофон"

### WebRTC Voice
- Peer.js для спрощення WebRTC
- Аудіо стрім через getUserMedia
- Simple-peer для P2P з'єднання

### Firebase Security Rules
- Користувачі можуть читати/писати тільки свої дані
- Публічні: nickname, verified, isOnline
- Приватні: email (для адмінів)

## Acceptance Criteria
1. Користувач може зареєструватися з унікальним ніком
2. Користувач може увійти
3. Користувач бачить свій профіль
4. "Знайти" з'єднує з випадковим користувачем
5. Працює голосовий чат
6. Показується ніка співрозмовника + галочка (якщо verified)
7. Кнопки "Наступний" і "Вийти" працюють
8. Темна тема, адаптивний дизайн
