package core

import (
	"bufio"
	_ "embed"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/comoland/como/js"
)

//go:embed js/readline.js
var readlineJs string

func readline(ctx *js.Context, global js.Value) {
	readline := ctx.EvalFunction("readline", readlineJs)
	defer readline.Free()

	exp := ctx.Object()
	exp.Dup().AutoFree()

	// Create interface constructor
	exp.Set("createInterface", func(args js.Arguments) interface{} {
		var options map[string]interface{}
		if args.Len() > 0 {
			if o, ok := args.Get(0).(map[string]interface{}); ok {
				options = o
			}
		}

		if options == nil {
			return ctx.Throw("TypeError: Missing required option 'input'")
		}

		// Create a new readline interface instance
		interfaceObj := ctx.Object()
		interfaceObj.Dup().AutoFree()

		// Store interface state
		var prompt string = "> "
		var history []string
		var historySize int = 30
		var closed bool = false
		var paused bool = false
		var terminal bool = true
		var lineBuffer string = ""
		var cursorPos int = 0

		// Parse options
		if p, ok := options["prompt"].(string); ok {
			prompt = p
		}
		if h, ok := options["historySize"].(int64); ok {
			historySize = int(h)
		}
		if t, ok := options["terminal"].(bool); ok {
			terminal = t
		}

		// Event emitter functionality
		eventListeners := make(map[string][]js.Value)

		// Add event listener
		interfaceObj.Set("on", func(args js.Arguments) interface{} {
			if args.Len() < 2 {
				return ctx.Throw("TypeError: Missing event name or listener")
			}
			
			eventName, ok := args.Get(0).(string)
			if !ok {
				return ctx.Throw("TypeError: Event name must be a string")
			}
			
			listener := args.GetValue(1)
			if !listener.IsFunction() {
				return ctx.Throw("TypeError: Listener must be a function")
			}

			if eventListeners[eventName] == nil {
				eventListeners[eventName] = make([]js.Value, 0)
			}
			eventListeners[eventName] = append(eventListeners[eventName], listener)
			
			return interfaceObj
		})

		// Emit event
		emit := func(eventName string, data ...interface{}) {
			if listeners, exists := eventListeners[eventName]; exists {
				for _, listener := range listeners {
					if listener.IsFunction() {
						listener.Call(data...)
					}
				}
			}
		}

		// Set prompt
		interfaceObj.Set("setPrompt", func(args js.Arguments) interface{} {
			if args.Len() > 0 {
				if p, ok := args.Get(0).(string); ok {
					prompt = p
				}
			}
			return nil
		})

		// Get prompt
		interfaceObj.Set("getPrompt", func(args js.Arguments) interface{} {
			return prompt
		})

		// Show prompt
		interfaceObj.Set("prompt", func(args js.Arguments) interface{} {
			if closed || paused {
				return nil
			}
			
			preserveCursor := false
			if args.Len() > 0 {
				if p, ok := args.Get(0).(bool); ok {
					preserveCursor = p
				}
			}

			if !preserveCursor {
				cursorPos = 0
				lineBuffer = ""
			}

			fmt.Print(prompt)
			return nil
		})

		// Write data
		interfaceObj.Set("write", func(args js.Arguments) interface{} {
			if closed {
				return nil
			}

			if args.Len() > 0 {
				if data, ok := args.Get(0).(string); ok {
					fmt.Print(data)
				}
			}
			return nil
		})

		// Question method
		interfaceObj.Set("question", func(args js.Arguments) interface{} {
			if args.Len() < 2 {
				return ctx.Throw("TypeError: Missing query or callback")
			}

			query, ok := args.Get(0).(string)
			if !ok {
				return ctx.Throw("TypeError: Query must be a string")
			}

			callback := args.GetValue(1)
			if !callback.IsFunction() {
				return ctx.Throw("TypeError: Callback must be a function")
			}

			if closed {
				return nil
			}

			return ctx.Async(func(async js.Promise) {
				// Print the question
				fmt.Print(query)

				// Read input
				scanner := bufio.NewScanner(os.Stdin)
				if scanner.Scan() {
					answer := scanner.Text()
					
					// Add to history
					if len(answer) > 0 && terminal {
						history = append(history, answer)
						if len(history) > historySize {
							history = history[1:]
						}
					}

					ctx.Channel <- func() {
						callback.Call(answer)
					}
					async.Resolve(answer)
				} else {
					ctx.Channel <- func() {
						callback.Call("")
					}
					async.Resolve("")
				}
			})
		})

		// Pause interface
		interfaceObj.Set("pause", func(args js.Arguments) interface{} {
			if !paused {
				paused = true
				emit("pause")
			}
			return nil
		})

		// Resume interface
		interfaceObj.Set("resume", func(args js.Arguments) interface{} {
			if paused {
				paused = false
				emit("resume")
			}
			return nil
		})

		// Close interface
		interfaceObj.Set("close", func(args js.Arguments) interface{} {
			if !closed {
				closed = true
				emit("close")
			}
			return nil
		})

		// Properties
		interfaceObj.Set("line", lineBuffer)
		interfaceObj.Set("cursor", cursorPos)

		// Setup signal handlers if terminal
		if terminal {
			// Setup signal handling in a goroutine
			go func() {
				sigChan := make(chan os.Signal, 1)
				signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTSTP, syscall.SIGCONT)

				for sig := range sigChan {
					switch sig {
					case syscall.SIGINT:
						ctx.Channel <- func() {
							emit("SIGINT")
						}
					case syscall.SIGTSTP:
						ctx.Channel <- func() {
							emit("SIGTSTP")
						}
					case syscall.SIGCONT:
						ctx.Channel <- func() {
							emit("SIGCONT")
						}
					}
				}
			}()

			// Start input reading in background
			go func() {
				scanner := bufio.NewScanner(os.Stdin)
				for scanner.Scan() && !closed {
					if paused {
						continue
					}

					line := scanner.Text()
					
					// Add to history
					if len(line) > 0 {
						history = append(history, line)
						if len(history) > historySize {
							history = history[1:]
						}
					}

					ctx.Channel <- func() {
						emit("line", line)
					}
				}
			}()
		}

		return interfaceObj
	})

	// Utility functions
	exp.Set("cursorTo", func(args js.Arguments) interface{} {
		if args.Len() < 2 {
			return ctx.Throw("TypeError: Missing stream or coordinates")
		}

		x, okX := args.Get(1).(int64)
		if !okX {
			return ctx.Throw("TypeError: X coordinate must be a number")
		}

		y := int64(0)
		if args.Len() > 2 {
			if yCoord, ok := args.Get(2).(int64); ok {
				y = yCoord
			}
		}

		// Move cursor to position
		fmt.Printf("\033[%d;%dH", y+1, x+1)
		return true
	})

	exp.Set("moveCursor", func(args js.Arguments) interface{} {
		if args.Len() < 3 {
			return ctx.Throw("TypeError: Missing stream or delta coordinates")
		}

		dx, okDx := args.Get(1).(int64)
		dy, okDy := args.Get(2).(int64)
		if !okDx || !okDy {
			return ctx.Throw("TypeError: Delta coordinates must be numbers")
		}

		// Move cursor relative to current position
		if dx != 0 {
			if dx > 0 {
				fmt.Printf("\033[%dC", dx)
			} else {
				fmt.Printf("\033[%dD", -dx)
			}
		}
		if dy != 0 {
			if dy > 0 {
				fmt.Printf("\033[%dB", dy)
			} else {
				fmt.Printf("\033[%dA", -dy)
			}
		}
		return true
	})

	exp.Set("clearLine", func(args js.Arguments) interface{} {
		if args.Len() < 2 {
			return ctx.Throw("TypeError: Missing stream or direction")
		}

		dir, ok := args.Get(1).(int64)
		if !ok {
			return ctx.Throw("TypeError: Direction must be a number")
		}

		switch dir {
		case -1: // to the left from cursor
			fmt.Print("\033[1K")
		case 1: // to the right from cursor
			fmt.Print("\033[0K")
		case 0: // the entire line
			fmt.Print("\033[2K")
		}
		return true
	})

	exp.Set("clearScreenDown", func(args js.Arguments) interface{} {
		// Clear screen from cursor down
		fmt.Print("\033[0J")
		return true
	})

	ret := readline.Call(exp)

	m := ctx.NewModule("readline")
	m.Export("default", ret)
	m.Exports(ret)
}
