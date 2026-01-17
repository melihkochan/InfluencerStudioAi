# Influencer Studio AI

<div align="center">
  
**AI-Powered Character-Based Photo & Video Generation Studio**

Modern web application for creating high-quality photos and videos using AI character DNA technology.

[![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-Latest-646CFF?logo=vite)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Enabled-3ECF8E?logo=supabase)](https://supabase.com/)

</div>

## ✨ Features

- 🎭 **Character DNA System**: Create and manage multiple characters with unique identity references
- 📸 **AI Photo Generation**: Generate high-quality photos using Google Gemini API
- 🎬 **AI Video Generation**: Create cinematic videos with character consistency using Veo API
- 🗄️ **Supabase Integration**: Persistent storage for characters, images, and videos
- 📦 **Album System**: Archive and organize generated content
- 🎨 **Style References**: Use pose and style references for better results
- ⚙️ **Advanced Camera Settings**: Control aspect ratio, camera angle, shot scale, and lens type
- 🎯 **Prompt-Based Scene Adaptation**: AI adapts clothing, accessories, and environment based on prompts

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- Google Gemini API key ([Get one here](https://ai.google.dev/))
- Supabase account ([Sign up free](https://supabase.com/))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/melihkochan/InfluencerStudioAi.git
   cd InfluencerStudioAi
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_supabase_key
   ```

4. **Set up Supabase database**
   
   See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for detailed database setup instructions.

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open in browser**
   
   Navigate to `http://localhost:5173` (or the port shown in terminal)

## 📁 Project Structure

```
influencerstudio/
├── App.tsx                 # Main application component
├── components/
│   └── Icons.tsx          # SVG icon components
├── services/
│   ├── geminiService.ts   # Google Gemini & Veo API integration
│   └── supabaseService.ts # Supabase database operations
├── types.ts               # TypeScript type definitions
├── database-schema.sql    # Supabase database schema
└── package.json           # Project dependencies
```

## 🎯 Usage

### Creating a Character

1. Click the **+** button in the Characters section
2. Enter a character name
3. Upload multiple reference images (DNA) to define the character's identity
4. The character is automatically saved to Supabase

### Generating Photos

1. Select a character from the sidebar
2. (Optional) Upload a style/pose reference image
3. Enter a scene description in the prompt field
4. (Optional) Configure camera settings (angle, scale, lens, aspect ratio)
5. Click the **GENERATE** button
6. Generated photos appear in the main area and are saved automatically

### Generating Videos

1. Switch to the **VIDEO** tab
2. Select a character
3. (Optional) Upload a reference image for video generation
4. Enter an action description (e.g., "dancing", "smiling", "walking")
5. Select aspect ratio (16:9 or 9:16)
6. Click **GENERATE**
7. Videos are processed and saved automatically

### Managing Content

- **Archive**: Click "ARŞİVE GÖNDER" to move items to the album
- **Download**: Download generated content with one click
- **Delete**: Remove items from history or album
- **Reference**: Use existing photos/videos as style references

## 🛠️ Technologies

- **React 18+**: UI framework
- **TypeScript**: Type safety
- **Vite**: Build tool and dev server
- **Tailwind CSS**: Styling
- **Google Gemini API**: Image generation (`gemini-3-pro-image-preview`)
- **Google Veo API**: Video generation (`veo-3.1-fast-generate-preview`)
- **Supabase**: Backend database and storage
- **React Hooks**: State management

## 📝 Key Features Explained

### Character DNA System
Characters are defined by multiple reference images that establish facial features, body type, hair color, and skin tone. The AI maintains this identity across all generations.

### Prompt-Based Adaptation
- **Clothing**: Automatically adapts based on scene description (formal, casual, sport, evening)
- **Accessories**: Adds jewelry, hair clips, etc. based on context
- **Environment**: Creates appropriate backgrounds for each scene
- **Hair Style**: Can adjust style while maintaining original color

### Identity Preservation
The AI is heavily prompted to maintain:
- Exact facial features and bone structure
- Original hair color (style can change)
- Body type and proportions
- Skin tone
- Character consistency across all frames (for videos)

## 🔧 Configuration

### Camera Settings (Photo Generation)

- **Angle**: Standard, Aerial (Drone), Bird's Eye View
- **Shot Scale**: Close-up, Medium, Wide, Long Distance
- **Lens Type**: Wide-angle, Telephoto, Portrait, Anamorphic
- **Aspect Ratio**: 9:16 (vertical), 16:9 (horizontal)

### Season & Lighting

Select from presets: Summer, Autumn, Winter, Spring, or Default

## 📊 Database Schema

The application uses Supabase with three main tables:
- `characters`: Character definitions with DNA images
- `generated_images`: All generated photos with metadata
- `generated_videos`: All generated videos with metadata

See `database-schema.sql` for full schema details.

## 🐛 Troubleshooting

### API Key Issues
- Ensure `GEMINI_API_KEY` is set in `.env.local`
- Check that the API key has access to Gemini and Veo APIs

### Supabase Connection
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` are correct
- Ensure database schema is set up correctly (see SUPABASE_SETUP.md)

### Generation Failures
- Check browser console for error messages
- Verify API quotas haven't been exceeded
- Ensure character has at least one DNA image

## 📄 License

This project is private and proprietary.

## 👨‍💻 Author

**Melih Koçhan**

- GitHub: [@melihkochan](https://github.com/melihkochan)

## 🙏 Acknowledgments

- Google Gemini & Veo APIs for AI generation capabilities
- Supabase for backend infrastructure
- React & Vite communities

---

**Note**: This is an active development project. Features and APIs may change.
