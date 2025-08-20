import pandas as pd
import re
from collections import Counter

def analyze_jersey_shore_episodes(csv_file_path):
    """
    Analyze Jersey Shore viewing history from Prime Video CSV file.
    
    Args:
        csv_file_path (str): Path to the PrimeVideo.ViewingHistory.csv file
    
    Returns:
        dict: Analysis results including episode counts and most watched episodes
    """
    
    # Read the CSV file
    print("Loading viewing history data...")
    df = pd.read_csv(csv_file_path)
    
    # Filter for Jersey Shore content
    jersey_shore_mask = df['Title'].str.contains('Jersey Shore', case=False, na=False)
    jersey_shore_df = df[jersey_shore_mask].copy()
    
    print(f"Found {len(jersey_shore_df)} Jersey Shore viewing records")
    
    # Clean up the titles (remove quotes and extra formatting)
    jersey_shore_df['Clean_Title'] = jersey_shore_df['Title'].str.replace('"', '').str.strip()
    
    # Count unique episodes watched
    unique_episodes = jersey_shore_df['Clean_Title'].nunique()
    print(f"Total unique Jersey Shore episodes watched: {unique_episodes}")
    
    # Count how many times each episode was watched
    episode_counts = jersey_shore_df['Clean_Title'].value_counts()
    
    # Get the most watched episodes
    most_watched = episode_counts.head(10)
    
    # Calculate total viewing time for Jersey Shore
    total_seconds = jersey_shore_df['Seconds Viewed'].sum()
    total_hours = total_seconds / 3600
    
    # Analyze by season if possible
    season_pattern = r'Season (\d+)'
    jersey_shore_df['Season'] = jersey_shore_df['Clean_Title'].str.extract(season_pattern)
    season_counts = jersey_shore_df['Season'].value_counts().sort_index()
    
    # Create results dictionary
    results = {
        'total_records': len(jersey_shore_df),
        'unique_episodes': unique_episodes,
        'total_viewing_hours': round(total_hours, 2),
        'most_watched_episodes': most_watched,
        'season_distribution': season_counts,
        'episode_counts': episode_counts
    }
    
    return results

def print_analysis_results(results):
    """Print formatted analysis results"""
    
    print("\n" + "="*60)
    print("JERSEY SHORE VIEWING ANALYSIS")
    print("="*60)
    
    print(f"\n📺 OVERVIEW:")
    print(f"   • Total viewing records: {results['total_records']:,}")
    print(f"   • Unique episodes watched: {results['unique_episodes']}")
    print(f"   • Total viewing time: {results['total_viewing_hours']:.1f} hours")
    
    print(f"\n🏆 TOP 10 MOST WATCHED EPISODES:")
    for i, (episode, count) in enumerate(results['most_watched_episodes'].items(), 1):
        print(f"   {i:2d}. {episode}")
        print(f"       Watched {count} times")
    
    if not results['season_distribution'].empty:
        print(f"\n📊 EPISODES WATCHED BY SEASON:")
        for season, count in results['season_distribution'].items():
            if pd.notna(season):
                print(f"   Season {season}: {count} episodes")
    
    # Additional statistics
    avg_watches_per_episode = results['total_records'] / results['unique_episodes']
    print(f"\n📈 STATISTICS:")
    print(f"   • Average times per episode: {avg_watches_per_episode:.1f}")
    
    # Episodes watched only once vs multiple times
    single_watches = sum(1 for count in results['episode_counts'] if count == 1)
    multiple_watches = results['unique_episodes'] - single_watches
    
    print(f"   • Episodes watched once: {single_watches}")
    print(f"   • Episodes watched multiple times: {multiple_watches}")
    
    if multiple_watches > 0:
        print(f"   • Rewatch rate: {(multiple_watches/results['unique_episodes']*100):.1f}%")

def save_detailed_report(results, output_file='jersey_shore_report.txt'):
    """Save detailed report to text file"""
    
    with open(output_file, 'w') as f:
        f.write("JERSEY SHORE VIEWING HISTORY REPORT\n")
        f.write("="*50 + "\n\n")
        
        f.write(f"Total viewing records: {results['total_records']:,}\n")
        f.write(f"Unique episodes watched: {results['unique_episodes']}\n")
        f.write(f"Total viewing time: {results['total_viewing_hours']:.1f} hours\n\n")
        
        f.write("COMPLETE EPISODE LIST (sorted by watch count):\n")
        f.write("-" * 50 + "\n")
        
        for i, (episode, count) in enumerate(results['episode_counts'].items(), 1):
            f.write(f"{i:3d}. {episode} ({count} times)\n")
    
    print(f"\n💾 Detailed report saved to: {output_file}")

# Main execution
if __name__ == "__main__":
    # Replace with your actual CSV file path
    csv_file_path = "PrimeVideo.ViewingHistory.csv"
    
    try:
        # Run the analysis
        results = analyze_jersey_shore_episodes(csv_file_path)
        
        # Print results to console
        print_analysis_results(results)
        
        # Save detailed report
        save_detailed_report(results)
        
    except FileNotFoundError:
        print(f"Error: Could not find the file '{csv_file_path}'")
        print("Please make sure the CSV file is in the same directory as this script.")
    except Exception as e:
        print(f"An error occurred: {str(e)}")
        print("Please check that your CSV file is formatted correctly.")