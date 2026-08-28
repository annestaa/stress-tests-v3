#!/bin/bash

# ==============================================================================
# Real-time Performance Monitor
# Monitors k6 output and displays key metrics
# ==============================================================================

COLORS=true
LOG_FILE="automation_optimized.log"

# Colors
if [ "$COLORS" = true ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    CYAN='\033[0;36m'
    BOLD='\033[1m'
    RESET='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    CYAN=''
    BOLD=''
    RESET=''
fi

clear
echo -e "${CYAN}${BOLD}"
echo "════════════════════════════════════════════════════════════════════════════════"
echo "  🚀 Real-time Performance Monitor - Optimized Mini Games Automation"
echo "════════════════════════════════════════════════════════════════════════════════"
echo -e "${RESET}"

# Check if log file exists
if [ ! -f "$LOG_FILE" ]; then
    echo -e "${YELLOW}⚠️  Log file not found: $LOG_FILE${RESET}"
    echo ""
    echo "Starting fresh monitoring session..."
    echo ""
    LOG_FILE="/dev/stdin"
fi

# Initialize counters
total_wins=0
total_rounds=0
total_points=0
errors_429=0
errors_500=0
last_success_rates=()
cycles=0

print_stats() {
    clear
    echo -e "${CYAN}${BOLD}"
    echo "════════════════════════════════════════════════════════════════════════════════"
    echo "  📊 Live Performance Dashboard"
    echo "════════════════════════════════════════════════════════════════════════════════"
    echo -e "${RESET}"
    echo ""
    
    # Calculate averages
    avg_sr=0
    if [ ${#last_success_rates[@]} -gt 0 ]; then
        sum=0
        for sr in "${last_success_rates[@]}"; do
            sum=$(echo "$sum + $sr" | bc)
        done
        avg_sr=$(echo "scale=1; $sum / ${#last_success_rates[@]}" | bc)
    fi
    
    win_rate=0
    if [ $total_rounds -gt 0 ]; then
        win_rate=$(echo "scale=1; $total_wins * 100 / $total_rounds" | bc)
    fi
    
    avg_points_per_win=0
    if [ $total_wins -gt 0 ]; then
        avg_points_per_win=$(echo "scale=0; $total_points / $total_wins" | bc)
    fi
    
    # Display metrics
    echo -e "${BOLD}Performance Metrics:${RESET}"
    echo "─────────────────────────────────────────────────────────────────────────────"
    
    printf "  ${GREEN}✓${RESET} Total Wins:          ${BOLD}%d${RESET}\n" $total_wins
    printf "  ${BLUE}○${RESET} Total Rounds:        ${BOLD}%d${RESET}\n" $total_rounds
    printf "  ${YELLOW}★${RESET} Total Points:        ${BOLD}%d${RESET}\n" $total_points
    printf "  ${CYAN}●${RESET} Cycles Completed:    ${BOLD}%d${RESET}\n" $cycles
    echo ""
    
    # Success rate with color coding
    sr_color=$GREEN
    if (( $(echo "$avg_sr < 70" | bc -l) )); then
        sr_color=$YELLOW
    fi
    if (( $(echo "$avg_sr < 50" | bc -l) )); then
        sr_color=$RED
    fi
    printf "  ${sr_color}📈 Avg Success Rate:  ${BOLD}%.1f%%${RESET}\n" $avg_sr
    
    wr_color=$GREEN
    if (( $(echo "$win_rate < 70" | bc -l) )); then
        wr_color=$YELLOW
    fi
    printf "  ${wr_color}🎯 Win Rate:          ${BOLD}%.1f%%${RESET}\n" $win_rate
    printf "  ${BLUE}💎 Avg Points/Win:    ${BOLD}%d${RESET}\n" $avg_points_per_win
    echo ""
    
    echo -e "${BOLD}Error Statistics:${RESET}"
    echo "─────────────────────────────────────────────────────────────────────────────"
    
    err_color=$GREEN
    if [ $errors_429 -gt 10 ]; then
        err_color=$YELLOW
    fi
    if [ $errors_429 -gt 20 ]; then
        err_color=$RED
    fi
    printf "  ${err_color}⛔ Error 429 (Rate Limit): ${BOLD}%d${RESET}\n" $errors_429
    
    err500_color=$GREEN
    if [ $errors_500 -gt 5 ]; then
        err500_color=$YELLOW
    fi
    printf "  ${err500_color}⚠️  Error 500 (Server):     ${BOLD}%d${RESET}\n" $errors_500
    echo ""
    
    # Status assessment
    echo -e "${BOLD}System Status:${RESET}"
    echo "─────────────────────────────────────────────────────────────────────────────"
    
    if (( $(echo "$avg_sr >= 80" | bc -l) )) && [ $errors_429 -lt 5 ]; then
        echo -e "  ${GREEN}${BOLD}🏆 EXCELLENT${RESET} - System performing optimally"
    elif (( $(echo "$avg_sr >= 70" | bc -l) )) && [ $errors_429 -lt 15 ]; then
        echo -e "  ${CYAN}${BOLD}✅ GOOD${RESET} - System performing well"
    elif (( $(echo "$avg_sr >= 50" | bc -l) )); then
        echo -e "  ${YELLOW}${BOLD}⚠️  MODERATE${RESET} - Consider tuning configuration"
    else
        echo -e "  ${RED}${BOLD}❌ POOR${RESET} - Configuration adjustment needed"
    fi
    
    echo ""
    echo -e "${BOLD}Recommendations:${RESET}"
    echo "─────────────────────────────────────────────────────────────────────────────"
    
    if [ $errors_429 -gt 20 ]; then
        echo -e "  ${RED}•${RESET} High 429 errors detected"
        echo -e "    ${YELLOW}→ Reduce INITIAL_BATCH_SIZE and MAX_BATCH_SIZE${RESET}"
        echo -e "    ${YELLOW}→ Increase MIN_ROUND_DELAY_SEC${RESET}"
        echo -e "    ${YELLOW}→ Set AGGRESSIVE_MODE=false${RESET}"
    elif [ $errors_429 -gt 10 ]; then
        echo -e "  ${YELLOW}•${RESET} Moderate 429 errors"
        echo -e "    ${CYAN}→ Consider slight reduction in batch size${RESET}"
    fi
    
    if (( $(echo "$avg_sr < 60" | bc -l) )); then
        echo -e "  ${YELLOW}•${RESET} Low success rate"
        echo -e "    ${CYAN}→ Increase TARGET_SUCCESS_RATE to 0.85${RESET}"
        echo -e "    ${CYAN}→ Add more delay between rounds${RESET}"
    fi
    
    if [ $errors_429 -lt 5 ] && (( $(echo "$avg_sr >= 85" | bc -l) )); then
        echo -e "  ${GREEN}•${RESET} Excellent performance!"
        echo -e "    ${CYAN}→ Can try increasing batch size for more throughput${RESET}"
    fi
    
    if [ $cycles -gt 0 ]; then
        avg_wins_per_cycle=$(echo "scale=1; $total_wins / $cycles" | bc)
        echo ""
        printf "  ${BLUE}ℹ️  Average wins per cycle: %.1f${RESET}\n" $avg_wins_per_cycle
        
        if (( $(echo "$avg_wins_per_cycle < 20" | bc -l) )); then
            echo -e "    ${YELLOW}→ Token underutilized. Consider more aggressive settings${RESET}"
        elif (( $(echo "$avg_wins_per_cycle > 40" | bc -l) )); then
            echo -e "    ${GREEN}→ Excellent token utilization!${RESET}"
        fi
    fi
    
    echo ""
    echo "─────────────────────────────────────────────────────────────────────────────"
    echo -e "  ${CYAN}Last updated: $(date '+%Y-%m-%d %H:%M:%S')${RESET}"
    echo -e "  Press ${BOLD}Ctrl+C${RESET} to stop monitoring"
    echo ""
}

# Parse log in real-time
if [ "$LOG_FILE" = "/dev/stdin" ]; then
    echo "Reading from stdin... (pipe k6 output here)"
    echo ""
fi

tail -f "$LOG_FILE" 2>/dev/null | while IFS= read -r line; do
    # Extract wins
    if echo "$line" | grep -q "✅.*+.*pts"; then
        wins=$(echo "$line" | grep -oP 'Batch: \K\d+(?=/)')
        if [ ! -z "$wins" ]; then
            total_wins=$((total_wins + wins))
            total_rounds=$((total_rounds + wins))
        fi
        
        # Extract points
        points=$(echo "$line" | grep -oP '\+\K\d+(?=pts)')
        if [ ! -z "$points" ]; then
            total_points=$((total_points + points))
        fi
        
        # Extract success rate
        sr=$(echo "$line" | grep -oP 'SR: \K[\d.]+(?=%)')
        if [ ! -z "$sr" ]; then
            last_success_rates+=("$sr")
            # Keep only last 20 values
            if [ ${#last_success_rates[@]} -gt 20 ]; then
                last_success_rates=("${last_success_rates[@]:1}")
            fi
        fi
    fi
    
    # Count cycles
    if echo "$line" | grep -q "Cycle complete:"; then
        cycles=$((cycles + 1))
        
        # Extract cycle wins
        cycle_wins=$(echo "$line" | grep -oP 'Cycle complete: \K\d+')
        if [ ! -z "$cycle_wins" ]; then
            # Already counted in batch stats
            :
        fi
    fi
    
    # Count errors
    if echo "$line" | grep -q "429"; then
        errors_429=$((errors_429 + 1))
    fi
    
    if echo "$line" | grep -q "500"; then
        errors_500=$((errors_500 + 1))
    fi
    
    # Update display every 5 wins or every 30 seconds
    if [ $((total_wins % 5)) -eq 0 ] || [ $((total_rounds % 10)) -eq 0 ]; then
        print_stats
    fi
done

# If we exit the loop, print final stats
print_stats
