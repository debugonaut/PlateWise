

\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{mitaoeminorreport}[2022/17/07 v2.0 MITAOE-E&TC Document Class for Project Reports]

\LoadClass[a4paper,11pt,onesided]{report}
\RequirePackage{ragged2e}
\RequirePackage{graphics}
\RequirePackage{color}
\RequirePackage{array}
\RequirePackage{multirow}
\RequirePackage{amsmath}
\RequirePackage{amsfonts}
\RequirePackage{amssymb}
\RequirePackage{graphicx}
\RequirePackage[caption]{subfig}
\RequirePackage{pifont}
\RequirePackage{longtable}
\RequirePackage{enumerate}
\RequirePackage{enumitem}
\RequirePackage[english]{babel}
\RequirePackage{array}
\RequirePackage[toc,page]{appendix}
\RequirePackage{hyperref}
\RequirePackage[notocbib]{apacite}
\RequirePackage{url}
\RequirePackage[intoc]{nomencl}
%\RequirePackage[left=1.25in,right=1in,top=1in,bottom=1in]{geometry}

\setlength{\topmargin}{-0.75in}
\setlength{\topskip}{0.5in}
\setlength{\textheight}{10.15in}
\setlength{\textwidth}{5.95in}
\setlength{\oddsidemargin}{0.25in}
\setlength{\evensidemargin}{0.35in}
\setlength{\footskip}{0.5in}
\setlength{\parindent}{0mm}
\setlength{\parskip}{3mm}



\renewcommand{\baselinestretch}{1.2}
\renewcommand{\arraystretch}{1.4}
\renewcommand{\bibname}{References}

\newcommand*{\@projecttitle}{}
\newcommand*{\projecttitle}[1]{\renewcommand*{\@projecttitle}{#1}}

\newcommand*{\@schoolname}{}
\newcommand*{\schoolname}[1]{\renewcommand*{\@schoolname}{#1}}

\newcommand*{\@department}{}
\newcommand*{\department}[1]{\renewcommand*{\@department}{#1}}

\newcommand*{\@projectadvisor}{}
\newcommand*{\projectadvisor}[1]{\renewcommand*{\@projectadvisor}{#1}}

\newcommand*{\@projectcoordinator}{}
\newcommand*{\projectcoordinator}[1]{\renewcommand*{\@projectcoordinator}{#1}}

\newcommand*{\@dean}{}
\newcommand*{\dean}[1]{\renewcommand*{\@dean}{#1}}

\newcommand*{\@academicyear}{}
\newcommand*{\academicyear}[1]{\renewcommand*{\@academicyear}{#1}}

\newcommand*{\@students}{}
\newcommand*{\student}[2]{%
\protected@edef\@students{\@students \large\bf#1 & \large\bf(Exam Seat No. #2)\\}%
}

\renewcommand{\titlepage}{%
\begin{center}
\vspace*{-18mm}

\rule{\textwidth}{0.01in}
\begin{figure}[h!]
    \begin{center}
        \includegraphics[scale=0.5]{maelogo}
    \end{center}
\end{figure}

\Large{\textbf {A Project Report on}}\\[3mm]
\LARGE{\textbf{\@projecttitle}} \\ [6mm]
\large{\textit{\textbf {Submitted by,}}} \\ [2mm]
\begin{tabular}{@{}p{6.0cm}l@{}l}
\@students
\end{tabular}

\vspace*{8mm}
\large{\bf{A Report submitted to MIT Academy of Engineering, Alandi(D), Pune,}}
\large{\bf{An Autonomous Institute Affiliated to Savitribai Phule Pune University}}
\large{\bf{in partial fulfillment of the requirements of}}
\vspace*{6mm}

{\large{\bf{SECOND YEAR BACHELOR OF TECHNOLOGY}}} \\[2mm]
{\large{in}} \\[2mm]
{\Large{\bf{\@department}}} \\[6mm]

{\LARGE{\textbf{Department of \@department}}} \\[3mm]
{\LARGE{\textbf{MIT Academy of Engineering}}} \\[2mm]
{\large{(An Autonomous Institute Affiliated to Savitribai Phule Pune University)}} \\[2mm]
{\Large\textbf{Alandi (D), Pune -- 412105}} \\[3mm]
{\LARGE{\textbf{(\@academicyear)}}} \\[2mm]
\rule{\textwidth}{0.01in}
\end{center}
\clearpage
}

\clearpage
\newcommand{\certificate}{}

\clearpage
\newcommand{\declaration}{%
\vspace*{-10mm}

\begin{center}
{\LARGE{\textbf{\underline{DECLARATION}}}} \\ [10mm]
\end{center}

\renewcommand{\baselinestretch}{1.6}
{\large{I the undersigned solemnly declare that this individual project report titled \textbf{``\@projecttitle''} is based on my own original work carried out as part of \textbf{Continuous Assessment (CA) Activity 2}.\\[2mm]
I assert that the statements made, technical implementations described, and conclusions drawn are an authentic outcome of my project work. I further certify that:}}
\begin{enumerate}
  \item {\large The work contained in this report is original and has been independently developed and designed by me.}
  \item {\large The work has not been submitted to any other Institution for any other degree, diploma, or certificate course.}
  \item {\large I have followed the academic guidelines and integrity standards provided by the Institute in writing this report.}
  \item {\large Whenever materials, external libraries, data, or APIs from third-party sources have been used, due credit and references have been provided in the text and bibliography.}
\end{enumerate}
\vspace{10mm}

\begin{center}
\begin{tabular}{@{}p{6.0cm}l@{}l@{}}
\@students
\end{tabular}
\vspace*{5mm}
\end{center}

\rule{\textwidth}{0.01in}
}

\clearpage
\endinput

