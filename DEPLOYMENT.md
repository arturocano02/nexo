# Deployment Guide

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Supabase Project**: Set up at [supabase.com](https://supabase.com)
3. **OpenAI API Key**: Get from [platform.openai.com](https://platform.openai.com)

## Environment Variables

Set these environment variables in your Vercel dashboard:

### Required Variables

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Environment
NODE_ENV=production
```

### Optional Variables

```bash
# Analytics (already configured)
VERCEL_ANALYTICS_ID=auto-generated
```

## Deployment Steps

### 1. Prepare Your Repository

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build the project
pnpm build
```

### 2. Deploy to Vercel

#### Option A: Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

#### Option B: GitHub Integration
1. Push your code to GitHub
2. Connect your GitHub repository to Vercel
3. Vercel will automatically deploy on every push to main

### 3. Configure Environment Variables

1. Go to your Vercel dashboard
2. Select your project
3. Go to Settings > Environment Variables
4. Add all required environment variables
5. Redeploy the project

### 4. Set Up Supabase

1. Create a new Supabase project
2. Run the migrations in `supabase/migrations/`
3. Set up Row Level Security (RLS) policies
4. Configure authentication providers

### 5. Test the Deployment

1. Visit your deployed URL
2. Test all major features:
   - User authentication
   - Survey completion
   - Chat functionality
   - Views refresh
   - Analytics tracking

## Database Setup

Run these SQL commands in your Supabase SQL editor:

```sql
-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE views_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE aggregates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own conversations" ON conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations" ON conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add similar policies for other tables
```

## Monitoring

### Analytics
- Vercel Analytics is automatically enabled
- Check the Analytics tab in your Vercel dashboard
- Monitor user interactions and performance

### Error Tracking
- Check Vercel Functions logs for API errors
- Monitor Supabase logs for database issues
- Use browser dev tools for client-side errors

## Performance Optimization

### Build Optimization
- The project uses Next.js 14 with App Router
- Images are optimized automatically
- CSS is purged in production builds

### Database Optimization
- Indexes are created for frequently queried columns
- RLS policies are optimized for performance
- Connection pooling is enabled

## Security

### Environment Variables
- Never commit `.env` files
- Use Vercel's environment variable system
- Rotate API keys regularly

### Database Security
- RLS is enabled on all tables
- API routes are protected with authentication
- CORS is configured appropriately

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check environment variables are set
   - Ensure all dependencies are installed
   - Check for TypeScript errors

2. **Runtime Errors**
   - Check Vercel Function logs
   - Verify environment variables are correct
   - Check Supabase connection

3. **Authentication Issues**
   - Verify Supabase configuration
   - Check RLS policies
   - Ensure auth providers are configured

### Getting Help

1. Check the Vercel documentation
2. Review Supabase logs
3. Check the project's GitHub issues
4. Contact support if needed

## Maintenance

### Regular Tasks
- Monitor analytics and user feedback
- Update dependencies monthly
- Review and rotate API keys
- Check for security updates

### Scaling
- Vercel automatically handles scaling
- Supabase scales with usage
- Monitor usage and upgrade plans as needed
