# Nexo - Political Views Platform

A modern, AI-powered platform for exploring and understanding political views through interactive surveys, chat, and data visualization.

## ✨ Features

### 🗳️ Interactive Survey
- Dynamic political survey with AI-powered analysis
- Real-time progress tracking
- Draft saving and resumption
- Personalized political profile generation

### 💬 AI Chat Interface
- Intelligent political discussions powered by OpenAI
- Real-time web search integration
- Context-aware responses
- View updates from conversations

### 📊 Data Visualization
- **Political Compass**: Interactive 2D political positioning
- **Radar Charts**: Multi-dimensional pillar analysis
- **Bar Charts**: Clear pillar score visualization
- **Distribution Maps**: Party-wide positioning insights

### 🎯 Advanced Analytics
- Real-time view updates from conversations
- Pillar score tracking and changes
- Party-wide aggregate analysis
- Comprehensive analytics tracking

### ✨ Smooth Animations
- Magic refresh moments with sparkle effects
- Smooth page transitions
- Loading skeletons and states
- Hover effects and micro-interactions

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- pnpm (recommended) or npm
- Supabase account
- OpenAI API key

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd nexo

# Install dependencies
pnpm install

# Set up environment variables
cp env.example .env.local
# Edit .env.local with your actual values

# Run the development server
pnpm dev
```

### Environment Variables

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
```

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, Tailwind Animate
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT-4
- **Analytics**: Vercel Analytics
- **Charts**: Recharts
- **Testing**: Jest, React Testing Library

### Project Structure
```
nexo/
├── app/                    # Next.js App Router
│   ├── (protected)/       # Protected routes
│   ├── api/              # API routes
│   ├── auth/             # Authentication pages
│   └── survey/           # Survey pages
├── src/
│   ├── components/       # React components
│   ├── lib/             # Utilities and configurations
│   └── types/           # TypeScript types
├── supabase/
│   └── migrations/       # Database migrations
└── __tests__/           # Test files
```

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

### Test Coverage
- Component testing with React Testing Library
- API route testing
- Utility function testing
- Analytics tracking verification

## 🚀 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

### Quick Deploy to Vercel

1. Push your code to GitHub
2. Connect to Vercel
3. Set environment variables
4. Deploy!

## 📊 Analytics

The platform includes comprehensive analytics tracking:

- **User Interactions**: Page views, button clicks, form submissions
- **Survey Analytics**: Completion rates, drop-off points
- **Chat Analytics**: Message counts, conversation lengths
- **Views Analytics**: Refresh frequency, pillar changes
- **Error Tracking**: API errors, client-side errors

## 🎨 Design System

### Colors
- **Primary**: Black (#000000)
- **Secondary**: Neutral grays
- **Accent**: Purple/Pink gradients for magic moments
- **Success**: Green for positive feedback
- **Error**: Red for error states

### Typography
- **Headings**: System font stack
- **Body**: System font stack
- **Code**: Monospace font

### Animations
- **Page Transitions**: Fade in with slide up
- **Magic Moments**: Sparkle effects on refresh
- **Hover States**: Subtle scale and shadow changes
- **Loading States**: Skeleton screens and spinners

## 🔧 Development

### Available Scripts

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm test         # Run tests
pnpm test:watch   # Run tests in watch mode
pnpm test:coverage # Run tests with coverage
```

### Code Style
- TypeScript for type safety
- ESLint for code quality
- Prettier for code formatting
- Tailwind CSS for styling

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

For support, please:
1. Check the documentation
2. Search existing issues
3. Create a new issue with detailed information

## 🔮 Roadmap

- [ ] Mobile app (React Native)
- [ ] Advanced political analysis
- [ ] Social features and sharing
- [ ] Multi-language support
- [ ] Advanced data export
- [ ] Real-time collaboration

---

Built with ❤️ for political discourse and understanding.
