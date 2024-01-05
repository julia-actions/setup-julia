if !occursin("hostedtoolcache", Sys.BINDIR)
    error("the wrong julia is being used: $(Sys.BINDIR)")
end
if VERSION >= v"1.7.0" # pkgdir was introduced here, and before then mtime wasn't a problem so just skip
    using Pkg
    src = pkgdir(Pkg, "src", "Pkg.jl")
    # mtime is when it's compressed, ctime is when the file is extracted
    if mtime(src) >= ctime(src)
        error("source mtime ($(mtime(src))) is not earlier than ctime ($(ctime(src)))")
    end
end
